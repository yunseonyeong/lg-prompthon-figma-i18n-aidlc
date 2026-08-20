/**
 * Layer 3 — 문맥 적합성 EXAONE 역검증
 *
 * 검증 명세(i18n-verification-spec.md)가 "(신규 필요) Layer 3 (EXAONE 호출 필요)"로
 * 지정한 스크립트입니다.
 *
 * ## 왜 주변 문맥이 필수인가
 *
 * 명세의 표현: "단건으로 물으면 못 잡는다."
 *
 *   en: Vertical Type *
 *   ko: 세로 유형          ← 오역
 *
 * 단독으로 물으면 EXAONE도 "세로 유형"이라 답합니다. 같은 프레임의
 * System Integrator / Business Type / End Customer 를 함께 주면
 * "B2B 파트너 분류 화면이므로 산업 분야"라고 판단합니다.
 *
 * 그래서 components-map.json 에서 같은 프레임의 형제 텍스트를 뽑아 함께 보냅니다.
 *
 * ## 설계 제약
 *
 * 1. **`validate:i18n`에 넣지 않습니다.** 명세가 "Layer 1/2/4는 API 없이 동작해야
 *    한다. CI에서 빠르게 돌릴 수 있어야 하고, API 장애 시에도 기본 검증은 되어야
 *    한다"고 요구합니다. 별도 명령(`npm run validate:layer3`)으로 분리합니다.
 *
 * 2. **결과는 WARN이고 확정 판정에 넣지 않습니다.** LLM 판정은 같은 입력에도
 *    흔들립니다. 이를 `confirmed`에 반영하면 확정 번역이 API 응답에 따라 요동치고
 *    라운드 지표가 오염됩니다. 사람이 보고 판단하는 자료로 씁니다.
 *
 * 3. **실패해도 죽지 않습니다.** API 장애 시 빈 결과와 에러 메모를 반환합니다.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { ASSIGNEES, type Issue, type LocaleBundle } from './types.js';
import { isExcludedSource } from './layers.js';
import { containsTerm } from '../retrieval/text-match.js';
import type { GlossaryData } from '../retrieval/glossary-loader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

// Dev-A 파이프라인과 동일한 순서로 환경변수를 읽는다.
// 해커톤 환경에서 FRIENDLI_API_KEY는 ~/.hermes/.env 에 발급되어 있다.
dotenv.config({ path: path.join(ROOT, '.env'), quiet: true });
dotenv.config({ path: path.join(os.homedir(), '.hermes', '.env'), quiet: true });

const CONFIG = {
  apiUrl:
    process.env.FRIENDLI_API_URL || 'https://api.friendli.ai/dedicated/v1/chat/completions',
  apiKey: process.env.FRIENDLI_API_KEY || '',
  model: process.env.FRIENDLI_MODEL || 'depe675tjc2rcpo',
  domain:
    'LG Business Cloud console — a B2B admin console for managing business sites, ' +
    'workspaces, device groups, users, roles and licenses',
  /** 한 번에 판정 요청할 항목 수. 프롬프트가 너무 길면 판정이 흐려진다 */
  chunkSize: 8,
  /** 청크 앞뒤로 문맥으로 포함할 형제 텍스트 개수 */
  contextWindow: 15,
};

const TARGET_LOCALES = ['ko', 'ja', 'zh-CN'] as const;

interface FrameChild {
  type: string;
  key: string;
  originalText: string;
}

interface Frame {
  frame: string;
  frameId: string;
  children: FrameChild[];
}

/** EXAONE에 판정을 요청할 1건 */
interface VerifyItem {
  index: number;
  key: string;
  role: string;
  en: string;
  translations: Partial<Record<string, string>>;
}

interface Verdict {
  index: number;
  locale: string;
  verdict: 'OK' | 'MISTRANSLATION';
  reason?: string;
  suggested?: string;
}

export interface Layer3Result {
  issues: Issue[];
  /** API를 실제로 호출했는가 */
  called: boolean;
  calls: number;
  totalTokens: number;
  /** 용어집 등재어를 이미 만족해 버린 EXAONE 이견 수 */
  suppressed: number;
  notes: string[];
}

export function loadFrames(): Frame[] {
  const p = path.join(ROOT, 'src', 'components-map.json');
  if (!fs.existsSync(p)) return [];
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as Frame[];
  } catch {
    return [];
  }
}

/**
 * 프롬프트 조립 — 형제 텍스트를 문맥으로 함께 제공.
 *
 * ⚠️ 중요: 모든 항목에 판정을 강제합니다.
 *
 * "문제만 보고하고 없으면 []" 형태로 물으면 모델이 쉬운 길을 택해
 * 명백한 오역(Vertical Type → 세로 유형)에도 항상 [] 를 반환합니다
 * (completion 2 tokens로 확인). 항목별 판정을 빠짐없이 요구하면 잡습니다.
 * 필터링은 클라이언트에서 합니다.
 */
export function buildPrompt(
  frameName: string,
  siblings: string[],
  items: VerifyItem[]
): string {
  const siblingList = siblings.map((s) => `"${s}"`).join(', ');

  const itemLines = items
    .map((it) => {
      const t = TARGET_LOCALES.filter((l) => it.translations[l])
        .map((l) => `      ${l}: "${it.translations[l]}"`)
        .join('\n');
      return `  ${it.index}. en: "${it.en}"   (role: ${it.role})\n${t}`;
    })
    .join('\n');

  return `You are auditing i18n translations for context fitness. Product domain:
${CONFIG.domain}

A translation can be literally correct yet wrong for this screen. Judge each item using
the SIBLING TEXTS from the same Figma frame — not the item in isolation.

Known traps in this domain:
- "Vertical Type" on a partner-classification screen = industry vertical (산업 분야 / 業種 / 行业类型),
  NOT screen orientation (세로).
- "Extend" beside license fields = extending a period (연장 / 延長 / 延长),
  NOT enlarging a view (확장).
- "Withdraw" for licenses = reclaiming (회수 / 回収 / 回收), NOT account withdrawal (탈퇴).
- "Player" in signage = playback device (재생 장치), NOT a game player.

FRAME: ${frameName}
SIBLING TEXTS IN THE SAME FRAME: ${siblingList}

ITEMS (${items.length} total):
${itemLines}

TASK
Output a verdict for EVERY item and EVERY locale shown. Do not omit any.
There must be exactly ${items.length} objects, one per item, in index order.

Use "BAD" only when the translation does not fit this screen's context —
a wrong sense of a polysemous word, or a term that contradicts the surrounding fields.
Do not flag stylistic preferences, punctuation, or the trailing "*" marker.

Respond ONLY with a JSON array in this exact shape:
[
  { "index": 1, "ko": "OK", "ja": "OK", "zh-CN": "OK" },
  { "index": 2, "ko": "BAD", "ko_reason": "why it does not fit", "ko_suggest": "better translation", "ja": "OK", "zh-CN": "OK" }
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
      temperature: 0, // 판정 재현성을 최대화 (LLM 특성상 완전 결정론은 아님)
      top_p: 0.95,
      max_tokens: 2500,
      chat_template_kwargs: { enable_thinking: false, preserve_thinking: false },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`EXAONE ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content ?? '',
    tokens: data.usage?.total_tokens ?? 0,
  };
}

function parseVerdicts(content: string): Verdict[] {
  const m = content.match(/\[[\s\S]*\]/);
  if (!m) return [];

  let arr: unknown;
  try {
    arr = JSON.parse(m[0]);
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];

  const out: Verdict[] = [];
  for (const row of arr) {
    if (typeof row !== 'object' || row === null) continue;
    const r = row as Record<string, unknown>;
    const index = typeof r.index === 'number' ? r.index : Number(r.index);
    if (!Number.isFinite(index)) continue;

    for (const locale of TARGET_LOCALES) {
      const v = r[locale];
      if (typeof v !== 'string') continue;
      if (v.toUpperCase() !== 'BAD') continue;
      out.push({
        index,
        locale,
        verdict: 'MISTRANSLATION',
        reason: typeof r[`${locale}_reason`] === 'string' ? (r[`${locale}_reason`] as string) : undefined,
        suggested: typeof r[`${locale}_suggest`] === 'string' ? (r[`${locale}_suggest`] as string) : undefined,
      });
    }
  }
  return out;
}

/**
 * 용어집과 교차 확인.
 *
 * EXAONE이 제안한 번역이 용어집 등재어와 다르면 용어집을 우선합니다.
 * (프로브에서 EXAONE은 "업종 유형"을 제안했는데 용어집은 "산업 분야"였습니다.
 *  둘 다 의미는 맞지만 일관성을 위해 등재어를 씁니다.)
 */
function reconcileWithGlossary(
  en: string,
  locale: string,
  actual: string,
  suggested: string | undefined,
  glossary: GlossaryData
): { expected?: string; note?: string; suppress?: boolean } {
  for (const entry of glossary.entries) {
    if (!entry.english || !containsTerm(en, entry.english)) continue;
    const registered =
      locale === 'ko' ? entry.ko : locale === 'ja' ? entry.ja : entry.zhCN;
    if (!registered) continue;

    // 현재 번역이 등재어를 이미 만족하면 EXAONE 이견을 버린다.
    // 용어집이 최종 권위이고, 여기서 억제하지 않으면
    // 등재어(예: Signage→사이니지)를 모델이 반대하는 오탐이 리포트를 오염시킨다.
    if (actual.toLowerCase().includes(registered.toLowerCase())) {
      return { suppress: true };
    }

    if (suggested && !suggested.includes(registered)) {
      return {
        expected: registered,
        note: `용어집 등재어 "${registered}" 우선 (EXAONE 제안: "${suggested}")`,
      };
    }
    return { expected: registered };
  }
  return suggested ? { expected: suggested } : {};
}

/**
 * Layer 3 EXAONE 역검증 실행.
 * API 키가 없거나 호출이 실패하면 빈 결과 + notes 를 반환합니다 (throw 안 함).
 */
export async function verifyContextWithExaone(
  bundle: LocaleBundle,
  glossary: GlossaryData
): Promise<Layer3Result> {
  const notes: string[] = [];
  const issues: Issue[] = [];

  if (!CONFIG.apiKey) {
    notes.push(
      'FRIENDLI_API_KEY 없음 → Layer 3 EXAONE 역검증을 건너뜁니다. ' +
        '.env 또는 ~/.hermes/.env 를 확인하세요.'
    );
    return { issues, called: false, calls: 0, totalTokens: 0, suppressed: 0, notes };
  }

  const frames = loadFrames();
  if (frames.length === 0) {
    notes.push('src/components-map.json 없음 → 프레임 문맥을 구성할 수 없습니다.');
    return { issues, called: false, calls: 0, totalTokens: 0, suppressed: 0, notes };
  }

  const en = bundle['en'] ?? {};
  let calls = 0;
  let totalTokens = 0;
  let suppressed = 0;

  for (const frame of frames) {

    // 검증 대상 구성 — 번역 제외 대상은 Layer 4 담당이므로 뺀다
    const candidates = frame.children.filter((c) => {
      const source = en[c.key];
      if (!source) return false;
      if (isExcludedSource(source, glossary.excludePatterns)) return false;
      return TARGET_LOCALES.some((l) => bundle[l]?.[c.key]);
    });

    for (let i = 0; i < candidates.length; i += CONFIG.chunkSize) {
      const chunk = candidates.slice(i, i + CONFIG.chunkSize);
      const items: VerifyItem[] = chunk.map((c, idx) => ({
        index: idx + 1,
        key: c.key,
        role: c.type,
        en: en[c.key],
        translations: Object.fromEntries(
          TARGET_LOCALES.map((l) => [l, bundle[l]?.[c.key]]).filter(([, v]) => v)
        ),
      }));

      // 형제 텍스트는 청크 위치 기준 인접 윈도우로 뽑는다.
      // 프레임 앞부분 30개를 고정으로 자르면 Vertical Type 주변의
      // System Integrator / Business Type / End Customer 가 문맥에서 빠져
      // 오역을 판정할 근거가 사라진다 (실측으로 확인).
      const firstIdx = frame.children.indexOf(chunk[0]);
      const lastIdx = frame.children.indexOf(chunk[chunk.length - 1]);
      const from = Math.max(0, firstIdx - CONFIG.contextWindow);
      const to = Math.min(frame.children.length, lastIdx + CONFIG.contextWindow + 1);
      const siblings = frame.children
        .slice(from, to)
        .map((c) => c.originalText)
        .filter(Boolean);

      try {
        const { content, tokens } = await callExaone(
          buildPrompt(frame.frame, siblings, items)
        );
        calls++;
        totalTokens += tokens;

        for (const v of parseVerdicts(content)) {
          if (v.verdict !== 'MISTRANSLATION') continue;
          const item = items.find((it) => it.index === v.index);
          if (!item) continue;
          const actual = item.translations[v.locale];
          if (!actual) continue;

          const rec = reconcileWithGlossary(item.en, v.locale, actual, v.suggested, glossary);
          if (rec.suppress) {
            suppressed++;
            continue;
          }

          issues.push({
            layer: 3,
            severity: 'WARN', // LLM 판정이므로 확정 판정에서 제외 (비결정성)
            key: item.key,
            locale: v.locale,
            message:
              `문맥 부적합 (EXAONE): "${item.en}" → "${actual}"` +
              (v.reason ? ` — ${v.reason}` : '') +
              (rec.note ? ` / ${rec.note}` : ''),
            assignee: ASSIGNEES.devBtoA,
            rule: 'Layer 3 EXAONE 역검증',
            actual,
            expected: rec.expected,
          });
        }
      } catch (e) {
        notes.push(
          `프레임 "${frame.frame}" 청크 ${i / CONFIG.chunkSize + 1} 실패: ${(e as Error).message.slice(0, 140)}`
        );
      }
    }
  }

  if (calls === 0 && notes.length === 0) {
    notes.push('검증 대상 항목이 없습니다.');
  }

  return { issues, called: calls > 0, calls, totalTokens, suppressed, notes };
}

export const LAYER3_CONFIG = CONFIG;
