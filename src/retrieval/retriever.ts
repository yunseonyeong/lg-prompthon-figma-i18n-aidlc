/**
 * 번역 컨텍스트 리트리버 (Dev-A 파이프라인용 공개 API)
 *
 * Dev-A의 translateBatch()가 EXAONE을 호출하기 전에 이 함수를 불러
 * 프롬프트에 주입할 컨텍스트를 받습니다.
 *
 *   import { initRetriever, retrieveForBatch } from '../retrieval/index.js';
 *
 *   await initRetriever();                        // 파이프라인 시작 시 1회
 *   const ctx = await retrieveForBatch(entries);  // 배치마다
 *
 *   // 1) 확정된 항목은 번역하지 않고 그대로 사용 (회귀 원천 차단)
 *   // 2) ctx.promptBlock 을 프롬프트에 삽입
 *
 * 검색 채널은 4개이고 성격이 다릅니다.
 *   ① 용어집 규칙   — 문자열 매칭 (결정론적)
 *   ② 확정 번역     — key 정확 조회 (결정론적)
 *   ③ 금지 패턴     — key 정확 조회 (결정론적)
 *   ④ 유사 사례     — 벡터 검색 (확률적, 임계값 게이팅)
 *
 * ⚠️ 이 함수는 절대 throw하지 않습니다. 저장소나 모델이 없으면
 *    빈 컨텍스트를 반환하고 stats.degraded=true로 알립니다.
 *    Dev-A 파이프라인이 리트리버 때문에 죽으면 안 됩니다.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { LocalIndex } from 'vectra';
import { embedQuery, activeBackend, DEFAULT_MIN_SCORE } from './embedder.js';
import { readIndexMeta } from './index-meta.js';
import { loadGlossary, type GlossaryEntry } from './glossary-loader.js';
import { containsTerm } from './text-match.js';
import {
  loadConfirmed,
  loadRejected,
  makeId,
  type ConfirmedEntry,
  type RejectedEntry,
} from './feedback-store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const TM_INDEX_PATH = path.join(ROOT, 'data', 'translation-memory');

export const TARGET_LOCALES = ['ko', 'ja', 'zh-CN'] as const;
export type TargetLocale = (typeof TARGET_LOCALES)[number];

/** Dev-A의 I18nEntry와 구조적으로 호환되는 최소 입력 */
export interface RetrievalEntry {
  key: string;
  source: string;
  context?: string;
  role?: string;
}

export interface GlossaryHit {
  term: string;
  context: string;
  ko: string;
  ja: string;
  'zh-CN': string;
}

export interface ForbiddenHit {
  key: string;
  locale: string;
  sourceText: string;
  wrong: string;
  reason: string;
  correct?: string;
}

export interface SimilarHit {
  sourceText: string;
  locale: string;
  translation: string;
  score: number;
}

/** key → locale → 확정 번역 */
export type ConfirmedMap = Record<string, Partial<Record<string, string>>>;

export interface BatchContext {
  /** 이미 확정된 번역. 이 항목은 번역 호출에서 제외해도 됩니다 */
  confirmed: ConfirmedMap;
  /** 이 배치의 원문에 등장한 용어집 항목 */
  glossaryTerms: GlossaryHit[];
  /** 과거 거부된 번역 (같은 실수 재발 방지) */
  forbidden: ForbiddenHit[];
  /** 의미가 가까운 과거 확정 사례 */
  similar: SimilarHit[];
  /** 프롬프트에 그대로 삽입하는 블록. 비어 있으면 '' */
  promptBlock: string;
  stats: {
    entries: number;
    confirmedCount: number;
    glossaryCount: number;
    forbiddenCount: number;
    similarCount: number;
    /** 저장소/인덱스/모델 일부를 쓸 수 없어 축소 동작 중 */
    degraded: boolean;
    notes: string[];
  };
}

export interface RetrieverOptions {
  /** 유사 사례 채택 최소 점수. 기본 0.84 (실측 균형점) */
  minScore?: number;
  /**
   * 배치당 유사 사례 최대 건수. 기본 5.
   * 컨텍스트를 많이 넣으면 프롬프트가 부풀고 EXAONE이 용어집 규칙을 흘립니다.
   */
  maxSimilar?: number;
  /** 벡터 검색 비활성화 (결정론적 채널만 사용) */
  disableVectorSearch?: boolean;
}

// ── 내부 상태 ──────────────────────────────────────────
interface RetrieverState {
  glossary: GlossaryEntry[];
  confirmed: Record<string, ConfirmedEntry>;
  rejected: Record<string, RejectedEntry[]>;
  tmIndex: LocalIndex | null;
  vectorReady: boolean;
  notes: string[];
  options: Required<RetrieverOptions>;
}

let state: RetrieverState | null = null;

const DEFAULTS: Required<RetrieverOptions> = {
  minScore: DEFAULT_MIN_SCORE,
  maxSimilar: 5,
  disableVectorSearch: false,
};

/**
 * 리트리버 초기화. 파이프라인 시작 시 1회 호출합니다.
 * 실패해도 throw하지 않고 축소 모드로 동작합니다.
 */
export async function initRetriever(options: RetrieverOptions = {}): Promise<void> {
  const notes: string[] = [];
  const opts = { ...DEFAULTS, ...options };

  let glossary: GlossaryEntry[] = [];
  try {
    glossary = loadGlossary().entries;
  } catch (e) {
    notes.push(`용어집 로드 실패: ${(e as Error).message}`);
  }

  let confirmed: Record<string, ConfirmedEntry> = {};
  let rejected: Record<string, RejectedEntry[]> = {};
  try {
    confirmed = loadConfirmed();
    rejected = loadRejected();
  } catch (e) {
    notes.push(`피드백 저장소 로드 실패: ${(e as Error).message}`);
  }

  let tmIndex: LocalIndex | null = null;
  let vectorReady = false;
  if (!opts.disableVectorSearch) {
    try {
      const idx = new LocalIndex(TM_INDEX_PATH);
      if (await idx.isIndexCreated()) {
        tmIndex = idx;
        // 임베딩 방식 일치 확인 — 좌표계가 다르면 검색이 무의미
        await embedQuery('warmup');
        const meta = readIndexMeta(TM_INDEX_PATH);
        const current = activeBackend();
        if (meta && current && meta.backend === current) {
          vectorReady = true;
        } else {
          notes.push(
            `벡터 검색 비활성: 임베딩 불일치 (인덱스=${meta?.backend ?? 'unknown'}, 현재=${current ?? 'unknown'})`
          );
        }
      } else {
        notes.push('벡터 검색 비활성: 번역 메모리 인덱스 없음 (npm run memory:index)');
      }
    } catch (e) {
      notes.push(`벡터 검색 비활성: ${(e as Error).message.slice(0, 100)}`);
    }
  }

  state = { glossary, confirmed, rejected, tmIndex, vectorReady, notes, options: opts };
}

/** 원문에 등장하는 용어집 항목 수집 (복합어 내부까지 — glossary §8-2) */
function findGlossaryHits(entries: RetrievalEntry[], glossary: GlossaryEntry[]): GlossaryHit[] {
  const hits = new Map<string, GlossaryHit>();
  for (const entry of entries) {
    for (const g of glossary) {
      if (!g.english) continue;
      if (!containsTerm(entry.source, g.english)) continue;
      if (hits.has(g.english)) continue;
      hits.set(g.english, {
        term: g.english,
        context: g.context,
        ko: g.ko,
        ja: g.ja,
        'zh-CN': g.zhCN,
      });
    }
  }
  // 긴 용어부터 (복합어가 먼저 적용되도록)
  return [...hits.values()].sort((a, b) => b.term.length - a.term.length);
}

/** 프롬프트 삽입용 블록 생성. 빈 섹션은 생략 */
function buildPromptBlock(ctx: Omit<BatchContext, 'promptBlock' | 'stats'>): string {
  const parts: string[] = [];

  if (ctx.glossaryTerms.length > 0) {
    parts.push(
      'GLOSSARY (MANDATORY — apply even inside longer phrases):\n' +
        ctx.glossaryTerms
          .map(
            (g) =>
              `  "${g.term}" → ko: "${g.ko}", ja: "${g.ja}", zh-CN: "${g['zh-CN']}"` +
              (g.context ? `   // ${g.context}` : '')
          )
          .join('\n')
    );
  }

  if (ctx.forbidden.length > 0) {
    parts.push(
      'PREVIOUSLY REJECTED — do NOT repeat these translations:\n' +
        ctx.forbidden
          .map(
            (f) =>
              `  "${f.sourceText}" [${f.locale}] ✗ "${f.wrong}" — ${f.reason}` +
              (f.correct ? ` → use "${f.correct}"` : '')
          )
          .join('\n')
    );
  }

  if (ctx.similar.length > 0) {
    parts.push(
      'SIMILAR APPROVED TRANSLATIONS (reference for consistency):\n' +
        ctx.similar
          .map((s) => `  "${s.sourceText}" → ${s.locale}: "${s.translation}"`)
          .join('\n')
    );
  }

  const confirmedKeys = Object.keys(ctx.confirmed);
  if (confirmedKeys.length > 0) {
    parts.push(
      'ALREADY APPROVED — reuse verbatim, do not re-translate:\n' +
        confirmedKeys
          .map((k) => {
            const byLocale = ctx.confirmed[k];
            const pairs = Object.entries(byLocale)
              .map(([loc, t]) => `${loc}: "${t}"`)
              .join(', ');
            return `  ${k} → ${pairs}`;
          })
          .join('\n')
    );
  }

  return parts.join('\n\n');
}

/**
 * 배치 단위 컨텍스트 검색.
 * initRetriever()를 먼저 호출하지 않으면 자동으로 초기화합니다.
 */
export async function retrieveForBatch(entries: RetrievalEntry[]): Promise<BatchContext> {
  if (!state) await initRetriever();
  const s = state!;

  const empty: BatchContext = {
    confirmed: {},
    glossaryTerms: [],
    forbidden: [],
    similar: [],
    promptBlock: '',
    stats: {
      entries: entries.length,
      confirmedCount: 0,
      glossaryCount: 0,
      forbiddenCount: 0,
      similarCount: 0,
      degraded: true,
      notes: s.notes,
    },
  };

  if (entries.length === 0) return empty;

  try {
    // ① 용어집 규칙
    const glossaryTerms = findGlossaryHits(entries, s.glossary);

    // ② 확정 번역 + ③ 금지 패턴
    const confirmed: ConfirmedMap = {};
    const forbidden: ForbiddenHit[] = [];

    for (const entry of entries) {
      for (const locale of TARGET_LOCALES) {
        const id = makeId(entry.key, locale);

        const c = s.confirmed[id];
        if (c) {
          confirmed[entry.key] ??= {};
          confirmed[entry.key][locale] = c.translation;
        }

        const rejectedList = s.rejected[id];
        if (rejectedList) {
          for (const r of rejectedList) {
            forbidden.push({
              key: entry.key,
              locale,
              sourceText: entry.source,
              wrong: r.wrong,
              reason: r.reason,
              correct: r.correct,
            });
          }
        }
      }
    }

    // ④ 유사 사례 — 확정되지 않은(=새로 번역해야 하는) 항목만 대상
    const similar: SimilarHit[] = [];
    if (s.vectorReady && s.tmIndex) {
      const needTranslation = entries.filter((e) => !confirmed[e.key]);
      const dedupe = new Map<string, SimilarHit>();

      for (const entry of needTranslation) {
        const vec = await embedQuery(entry.source);
        const results = await s.tmIndex.queryItems(vec, entry.source, 3);
        for (const r of results) {
          if (r.score < s.options.minScore) continue;
          const m = r.item.metadata as Record<string, string>;
          // 자기 자신은 제외
          if (m.sourceText === entry.source) continue;
          const dk = `${m.sourceText}::${m.locale}`;
          const prev = dedupe.get(dk);
          if (!prev || prev.score < r.score) {
            dedupe.set(dk, {
              sourceText: m.sourceText,
              locale: m.locale,
              translation: m.translation,
              score: r.score,
            });
          }
        }
      }

      similar.push(
        ...[...dedupe.values()]
          .sort((a, b) => b.score - a.score)
          .slice(0, s.options.maxSimilar)
      );
    }

    const core = { confirmed, glossaryTerms, forbidden, similar };
    return {
      ...core,
      promptBlock: buildPromptBlock(core),
      stats: {
        entries: entries.length,
        confirmedCount: Object.keys(confirmed).length,
        glossaryCount: glossaryTerms.length,
        forbiddenCount: forbidden.length,
        similarCount: similar.length,
        degraded: !s.vectorReady,
        notes: s.notes,
      },
    };
  } catch (e) {
    // 리트리버 실패가 파이프라인을 죽이지 않도록
    return {
      ...empty,
      stats: { ...empty.stats, notes: [...s.notes, `검색 실패: ${(e as Error).message}`] },
    };
  }
}

/** 진단용 — 현재 리트리버 상태 */
export function retrieverStatus(): {
  initialized: boolean;
  glossaryTerms: number;
  confirmed: number;
  rejected: number;
  vectorReady: boolean;
  notes: string[];
} {
  if (!state) {
    return { initialized: false, glossaryTerms: 0, confirmed: 0, rejected: 0, vectorReady: false, notes: [] };
  }
  return {
    initialized: true,
    glossaryTerms: state.glossary.length,
    confirmed: Object.keys(state.confirmed).length,
    rejected: Object.keys(state.rejected).length,
    vectorReady: state.vectorReady,
    notes: state.notes,
  };
}

/** 테스트용 — 내부 상태 리셋 */
export function _resetRetriever(): void {
  state = null;
}
