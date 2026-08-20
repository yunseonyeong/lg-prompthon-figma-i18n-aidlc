/**
 * 피드백 반영 재번역 (US-2.4)
 *
 * 수용 기준:
 *   - FAIL 항목에 대해 구체적 사유를 i18n-agent에 전달
 *   - i18n-agent가 피드백을 반영하여 재번역 수행
 *   - 최대 3회 재시도 후에도 FAIL이면 사람에게 에스컬레이션
 *
 * ## 왜 src/locales 를 직접 고치지 않는가
 *
 * locale JSON은 Dev-A의 산출물입니다. 검증자가 대상을 직접 고치면
 *   1) 검증의 의미가 없어지고 (스스로 만든 답을 스스로 통과시킴)
 *   2) Dev-A가 파이프라인을 다시 돌리면 덮어써져 사라집니다
 *
 * 그래서 **패치 파일**을 산출하고 적용은 Dev-A가 합니다.
 * 패치에 담기는 것은 재검증을 통과한 번역뿐입니다.
 *
 * ## 루프 구조
 *
 *   FAIL 항목 수집 (Layer 2/3만 — Layer 1은 구조, Layer 4는 추출 문제)
 *      ↓
 *   EXAONE 재번역 (용어집 + 거부 이력 + 형제 문맥 주입)
 *      ↓
 *   메모리에서 재검증
 *      ↓
 *   통과 → 패치에 포함
 *   실패 → 사유를 누적해 재시도 (최대 3회)
 *      ↓
 *   3회 초과 → 에스컬레이션
 */
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import type { GlossaryData } from '../retrieval/glossary-loader.js';
import type { RejectedEntry } from '../retrieval/feedback-store.js';
import { makeId } from '../retrieval/feedback-store.js';
import { containsTerm } from '../retrieval/text-match.js';
import { runAllLayers, TARGET_LOCALES } from './layers.js';
import { MAX_RETRIES } from './escalation.js';
import type { Issue, LocaleBundle } from './types.js';
import { loadFrames } from './layer3-exaone.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

// ~/.hermes/.env 를 먼저 깔고 프로젝트 .env 로 덮어쓴다.
// override: true — dotenv 기본값은 기존 환경변수를 덮어쓰지 않아서,
// 셸에 placeholder 가 남아 있으면 .env 를 고쳐도 반영되지 않는다.
dotenv.config({ path: path.join(os.homedir(), '.hermes', '.env'), override: true, quiet: true });
dotenv.config({ path: path.join(ROOT, '.env'), override: true, quiet: true });

const CONFIG = {
  apiUrl:
    process.env.FRIENDLI_API_URL || 'https://api.friendli.ai/dedicated/v1/chat/completions',
  apiKey: process.env.FRIENDLI_API_KEY || '',
  model: process.env.FRIENDLI_MODEL || 'depe675tjc2rcpo',
  domain:
    'LG Business Cloud console — a B2B admin console for managing business sites, ' +
    'workspaces, device groups, users, roles and licenses',
  batchSize: 8,
};

/** 재번역 대상 1건 */
interface Target {
  key: string;
  sourceText: string;
  /** locale → 현재(거부된) 번역 */
  current: Partial<Record<string, string>>;
  /** locale → 거부 사유 목록 */
  reasons: Partial<Record<string, string[]>>;
  /** 같은 프레임의 형제 텍스트 */
  siblings: string[];
}

export interface PatchEntry {
  key: string;
  locale: string;
  before: string;
  after: string;
  /** 몇 번째 시도에서 통과했는지 */
  attempt: number;
  reason: string;
}

export interface RetranslateResult {
  /** 재검증을 통과한 번역 */
  patch: PatchEntry[];
  /** 3회 시도 후에도 실패한 항목 */
  unresolved: Array<{
    key: string;
    locale: string;
    sourceText: string;
    attempts: number;
    lastTried: string;
    remainingIssues: string[];
  }>;
  attempts: number;
  calls: number;
  totalTokens: number;
  called: boolean;
  notes: string[];
}

/** 재번역으로 해결 가능한 이슈인가 */
function isRetranslatable(issue: Issue): boolean {
  // Layer 1 = 구조적 결함(key 누락 등) → 번역으로 해결 안 됨
  // Layer 4 = 추출 문제 → 번역으로 해결하면 안 됨 (명세 명시)
  // Layer 0 = 축적 피드백 기반 → 원인은 아래 계층에 있음
  if (issue.layer !== 2 && issue.layer !== 3) return false;
  if (issue.severity === 'INFO') return false;
  if (issue.locale === 'en') return false;
  return true;
}

/** 프레임별 형제 텍스트 색인 */
function buildSiblingIndex(): Map<string, string[]> {
  const idx = new Map<string, string[]>();
  for (const frame of loadFrames()) {
    const texts = frame.children.map((c) => c.originalText).filter(Boolean);
    for (const child of frame.children) idx.set(child.key, texts);
  }
  return idx;
}

/** 재번역 대상 수집 */
export function collectTargets(
  bundle: LocaleBundle,
  issues: Issue[],
  excludeIds: Set<string>
): Target[] {
  const en = bundle['en'] ?? {};
  const siblingIdx = buildSiblingIndex();
  const byKey = new Map<string, Target>();

  for (const issue of issues) {
    if (!isRetranslatable(issue)) continue;
    for (const rawLocale of issue.locale.split(',')) {
      const locale = rawLocale.trim();
      if (!TARGET_LOCALES.includes(locale as (typeof TARGET_LOCALES)[number])) continue;
      if (excludeIds.has(makeId(issue.key, locale))) continue;

      const current = bundle[locale]?.[issue.key];
      if (current === undefined) continue;

      let t = byKey.get(issue.key);
      if (!t) {
        const all = siblingIdx.get(issue.key) ?? [];
        // 문맥은 앞뒤로 제한 — 프레임 전체를 넣으면 프롬프트가 부풀고 판정이 흐려진다
        const pos = all.indexOf(en[issue.key]);
        const from = pos >= 0 ? Math.max(0, pos - 12) : 0;
        t = {
          key: issue.key,
          sourceText: en[issue.key] ?? '',
          current: {},
          reasons: {},
          siblings: all.slice(from, from + 25),
        };
        byKey.set(issue.key, t);
      }
      t.current[locale] = current;
      t.reasons[locale] ??= [];
      const msg = `${issue.message}${issue.expected ? ` (기대: ${issue.expected})` : ''}`;
      if (!t.reasons[locale]!.includes(msg)) t.reasons[locale]!.push(msg);
    }
  }

  return [...byKey.values()];
}

/** 과거 거부 이력을 금지 목록으로 (같은 실수 반복 방지) */
function forbiddenFor(
  key: string,
  locale: string,
  rejected: Record<string, RejectedEntry[]>
): string[] {
  return (rejected[makeId(key, locale)] ?? []).map((r) => r.wrong);
}

function buildPrompt(
  targets: Target[],
  glossary: GlossaryData,
  rejected: Record<string, RejectedEntry[]>
): string {
  // 이 배치의 원문에 등장하는 용어만 추린다
  const terms = glossary.entries.filter(
    (e) => e.english && targets.some((t) => containsTerm(t.sourceText, e.english))
  );
  const glossaryBlock =
    terms.length > 0
      ? terms
          .map((e) => `  "${e.english}" → ko: "${e.ko}", ja: "${e.ja}", zh-CN: "${e.zhCN}"`)
          .join('\n')
      : '  (none matched)';

  const itemBlock = targets
    .map((t, i) => {
      const lines: string[] = [
        `  ${i + 1}. en: "${t.sourceText}"`,
        `     nearby texts in the same frame: ${t.siblings.slice(0, 20).map((s) => `"${s}"`).join(', ')}`,
      ];
      for (const locale of TARGET_LOCALES) {
        const cur = t.current[locale];
        if (!cur) continue;
        lines.push(`     ${locale} REJECTED: "${cur}"`);
        for (const r of t.reasons[locale] ?? []) lines.push(`       reason: ${r}`);
        const forbidden = forbiddenFor(t.key, locale, rejected);
        if (forbidden.length > 0) {
          lines.push(
            `       previously rejected (do NOT reuse): ${forbidden.map((f) => `"${f}"`).join(', ')}`
          );
        }
      }
      return lines.join('\n');
    })
    .join('\n');

  const localesNeeded = [
    ...new Set(targets.flatMap((t) => Object.keys(t.current))),
  ];

  return `You are fixing rejected i18n translations for this product:
${CONFIG.domain}

Each item below FAILED review. The reason is given. Produce a corrected translation.

RULES
1. GLOSSARY IS MANDATORY. Apply the registered translation even inside longer phrases.
   "Workspace/Group Settings" must become "워크스페이스/그룹 설정", not "작업 공간/그룹 설정".
2. Do NOT reuse any translation listed as previously rejected.
3. Product names are never translated. Keep them in English.
4. Preserve trailing markers such as " *" and placeholders like {0} or {{name}} exactly.
5. Use the nearby frame texts to pick the right sense of ambiguous words.
6. Keep it concise — these are UI labels, buttons and titles.

GLOSSARY (applies to this batch):
${glossaryBlock}

ITEMS TO FIX:
${itemBlock}

Respond ONLY with a JSON array. Include every item, and every locale that was rejected
for that item (${localesNeeded.join(', ')}):
[
  { "index": 1, "ko": "corrected", "ja": "corrected", "zh-CN": "corrected" }
]`;
}

async function callExaone(prompt: string): Promise<{ content: string; tokens: number }> {
  const res = await fetch(CONFIG.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Bearer ${CONFIG.apiKey}`,
    },
    body: JSON.stringify({
      model: CONFIG.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      top_p: 0.95,
      max_tokens: 2000,
      chat_template_kwargs: { enable_thinking: false, preserve_thinking: false },
    }),
  });
  if (!res.ok) {
    throw new Error(`EXAONE ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content ?? '',
    tokens: data.usage?.total_tokens ?? 0,
  };
}

function parseCorrections(content: string): Map<number, Record<string, string>> {
  const out = new Map<number, Record<string, string>>();
  const m = content.match(/\[[\s\S]*\]/);
  if (!m) return out;
  try {
    const arr = JSON.parse(m[0]);
    if (!Array.isArray(arr)) return out;
    for (const row of arr) {
      if (typeof row !== 'object' || row === null) continue;
      const r = row as Record<string, unknown>;
      const index = Number(r.index);
      if (!Number.isFinite(index)) continue;
      const rec: Record<string, string> = {};
      for (const locale of TARGET_LOCALES) {
        const v = r[locale];
        if (typeof v === 'string' && v.trim()) rec[locale] = v.trim();
      }
      if (Object.keys(rec).length > 0) out.set(index, rec);
    }
  } catch {
    /* 파싱 실패는 재시도로 처리 */
  }
  return out;
}

/**
 * 재번역 루프 실행.
 *
 * bundle 을 변경하지 않습니다. 통과한 번역만 patch 로 반환합니다.
 */
export async function retranslate(
  bundle: LocaleBundle,
  glossary: GlossaryData,
  rejected: Record<string, RejectedEntry[]>,
  escalatedIds: Set<string>,
  options: { maxAttempts?: number } = {}
): Promise<RetranslateResult> {
  const maxAttempts = options.maxAttempts ?? MAX_RETRIES;
  const notes: string[] = [];
  const patch: PatchEntry[] = [];
  let calls = 0;
  let totalTokens = 0;

  if (!CONFIG.apiKey) {
    notes.push('FRIENDLI_API_KEY 없음 → 재번역을 수행할 수 없습니다.');
    return { patch, unresolved: [], attempts: 0, calls, totalTokens, called: false, notes };
  }

  // 작업 사본 — 원본 bundle 은 건드리지 않는다
  let working: LocaleBundle = JSON.parse(JSON.stringify(bundle));
  const original: LocaleBundle = JSON.parse(JSON.stringify(bundle));

  let attempt = 0;
  let targets: Target[] = [];

  for (attempt = 1; attempt <= maxAttempts; attempt++) {
    const issues = runAllLayers(working, glossary);
    targets = collectTargets(working, issues, escalatedIds);

    if (targets.length === 0) {
      notes.push(`시도 ${attempt}: 재번역 대상이 없습니다.`);
      break;
    }

    let corrected = 0;

    for (let i = 0; i < targets.length; i += CONFIG.batchSize) {
      const batch = targets.slice(i, i + CONFIG.batchSize);
      try {
        const { content, tokens } = await callExaone(
          buildPrompt(batch, glossary, rejected)
        );
        calls++;
        totalTokens += tokens;

        const corrections = parseCorrections(content);
        for (let j = 0; j < batch.length; j++) {
          const rec = corrections.get(j + 1);
          if (!rec) continue;
          const t = batch[j];
          for (const locale of Object.keys(t.current)) {
            const next = rec[locale];
            if (!next) continue;
            if (next === working[locale][t.key]) continue; // 변화 없음
            working[locale][t.key] = next;
            corrected++;
          }
        }
      } catch (e) {
        notes.push(
          `시도 ${attempt} 배치 ${Math.floor(i / CONFIG.batchSize) + 1} 실패: ${(e as Error).message.slice(0, 140)}`
        );
      }
    }

    if (corrected === 0) {
      notes.push(`시도 ${attempt}: 변경된 번역이 없어 루프를 중단합니다.`);
      break;
    }

    // 재검증 — 이 시도에서 해결된 항목을 패치에 담는다
    const after = runAllLayers(working, glossary);
    const stillBad = new Set(
      after.filter(isRetranslatable).flatMap((iss) =>
        iss.locale.split(',').map((l) => makeId(iss.key, l.trim()))
      )
    );

    for (const t of targets) {
      for (const locale of Object.keys(t.current)) {
        const id = makeId(t.key, locale);
        if (stillBad.has(id)) continue;
        const before = original[locale]?.[t.key];
        const afterVal = working[locale]?.[t.key];
        if (before === undefined || afterVal === undefined || before === afterVal) continue;
        if (patch.some((p) => p.key === t.key && p.locale === locale)) continue;
        patch.push({
          key: t.key,
          locale,
          before,
          after: afterVal,
          attempt,
          reason: (t.reasons[locale] ?? []).join(' / '),
        });
      }
    }

    const remaining = collectTargets(working, after, escalatedIds);
    if (remaining.length === 0) {
      notes.push(`시도 ${attempt}: 전체 해결`);
      break;
    }
  }

  // 미해결 항목
  const finalIssues = runAllLayers(working, glossary);
  const unresolvedTargets = collectTargets(working, finalIssues, escalatedIds);
  const unresolved = unresolvedTargets.flatMap((t) =>
    Object.keys(t.current).map((locale) => ({
      key: t.key,
      locale,
      sourceText: t.sourceText,
      attempts: Math.min(attempt, maxAttempts),
      lastTried: working[locale]?.[t.key] ?? '',
      remainingIssues: t.reasons[locale] ?? [],
    }))
  );

  return {
    patch,
    unresolved,
    attempts: Math.min(attempt, maxAttempts),
    calls,
    totalTokens,
    called: calls > 0,
    notes,
  };
}

/** 패치를 Dev-A가 적용할 수 있는 형태로 직렬화 */
export function renderPatchJson(result: RetranslateResult): string {
  const byLocale: Record<string, Record<string, string>> = {};
  for (const p of result.patch) {
    byLocale[p.locale] ??= {};
    byLocale[p.locale][p.key] = p.after;
  }
  return JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      note:
        'Dev-B 재번역 제안입니다. src/locales 를 직접 수정하지 않았습니다. ' +
        '아래 값은 4계층 재검증을 통과한 번역만 담고 있습니다.',
      attempts: result.attempts,
      patchCount: result.patch.length,
      unresolvedCount: result.unresolved.length,
      patch: byLocale,
      details: result.patch,
      unresolved: result.unresolved,
    },
    null,
    2
  );
}

export const RETRANSLATE_CONFIG = CONFIG;
