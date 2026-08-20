/**
 * 번역 컨텍스트 리트리버 — 공개 진입점
 *
 * Dev-A 파이프라인에서 사용:
 *   import { initRetriever, retrieveForBatch } from '../retrieval/index.js';
 */

// ── Dev-A가 사용하는 주 API ──
export {
  initRetriever,
  retrieveForBatch,
  retrieverStatus,
  TARGET_LOCALES,
  type RetrievalEntry,
  type BatchContext,
  type RetrieverOptions,
  type GlossaryHit,
  type ForbiddenHit,
  type SimilarHit,
  type ConfirmedMap,
  type TargetLocale,
} from './retriever.js';

// ── 임베딩 (Dev-B 스크립트/직접 사용) ──
export {
  embedDocuments,
  embedQuery,
  activeBackend,
  describeBackend,
  EMBED_MODEL_ID,
  EMBED_DIM,
  DEFAULT_MIN_SCORE,
  STRICT_MIN_SCORE,
  type Backend,
} from './embedder.js';

// ── 피드백 저장소 (Dev-B 검증 루프) ──
export {
  loadConfirmed,
  saveConfirmed,
  loadRejected,
  saveRejected,
  loadExclusions,
  saveExclusions,
  loadRounds,
  appendRound,
  nextRoundNumber,
  makeId,
  FEEDBACK_PATHS,
  type ConfirmedEntry,
  type RejectedEntry,
  type ExclusionEntry,
  type RoundMetrics,
} from './feedback-store.js';

// ── 용어집 ──
export {
  loadGlossary,
  buildGlossaryMap,
  type GlossaryEntry,
  type GlossaryData,
} from './glossary-loader.js';

// ── 인덱스 메타 ──
export {
  readIndexMeta,
  writeIndexMeta,
  assertCompatible,
  type IndexMeta,
} from './index-meta.js';
