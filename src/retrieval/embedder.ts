/**
 * 임베딩 제공자 (multilingual-e5-small)
 *
 * 모델: intfloat/multilingual-e5-small (MIT) — ONNX 변환판 Xenova/multilingual-e5-small
 * 차원: 384 / 언어: 100개 (en, ko, ja, zh-CN 포함)
 *
 * ⚠️ E5 계열은 prefix가 필수입니다.
 *   - 문서(코퍼스): "passage: "
 *   - 질의: "query: "
 * 모델 카드 FAQ: "Yes, this is how the model is trained, otherwise you will
 * see a performance degradation."
 *
 * 모델 로드 실패(네트워크 단절 등) 시 해시 기반 벡터로 자동 fallback 합니다.
 * 두 방식은 벡터 공간이 완전히 다르므로, 같은 인덱스에 혼용하면 검색이 망가집니다.
 * 이를 막기 위해 실제 사용된 방식을 activeBackend()로 노출하고,
 * 인덱싱 스크립트가 이를 인덱스 메타에 기록합니다.
 */
import { textToVector as hashVector, VECTOR_DIM } from './embeddings.js';

export const EMBED_MODEL_ID = 'Xenova/multilingual-e5-small';
export const EMBED_DIM = 384;

/**
 * few-shot 주입/유사사례 채택 임계값 (실측 기준).
 *
 * `npm run bench:threshold` 측정 결과:
 *   정답 1위 점수 분포: min 0.8385 / 중앙 0.8837
 *   오답 1위 점수 분포: min 0.8003 / 중앙 0.8243 / max 0.8581
 *
 *   0.82 → precision 81.3% / recall 100%
 *   0.84 → precision 92.3% / recall  92.3%   ← 균형점
 *   0.86 → precision  100% / recall  61.5%
 *
 * ⚠️ E5는 코사인 점수가 0.7~1.0에 몰립니다. 0.5/0.7 같은 값은 아무것도 걸러내지 못합니다.
 */
export const DEFAULT_MIN_SCORE = 0.84;
/** 노이즈를 절대 허용하지 않아야 할 때 (precision 100%) */
export const STRICT_MIN_SCORE = 0.86;

/** 실제로 사용된 백엔드 */
export type Backend = 'e5-small' | 'hash-fallback';

const BATCH_SIZE = 32;

let extractor: unknown = null;
let loadFailed = false;
let backend: Backend | null = null;

/** 현재 활성 백엔드. 아직 임베딩을 수행하지 않았으면 null */
export function activeBackend(): Backend | null {
  return backend;
}

/** 모델 로드 (최초 1회). 실패 시 false 반환 */
async function ensureModel(): Promise<boolean> {
  if (extractor) return true;
  if (loadFailed) return false;

  try {
    const { pipeline, env } = await import('@huggingface/transformers');
    // 원격(HF Hub) 모델만 사용. 최초 1회 다운로드 후 node_modules/.cache에 캐시됨
    env.allowLocalModels = false;
    extractor = await pipeline('feature-extraction', EMBED_MODEL_ID, { dtype: 'q8' });
    return true;
  } catch (err) {
    loadFailed = true;
    console.warn(
      `⚠️  임베딩 모델 로드 실패 → 해시 fallback으로 동작합니다.\n   사유: ${(err as Error).message.slice(0, 160)}`
    );
    return false;
  }
}

/** prefix를 붙여 배치 임베딩 수행 */
async function embedWithPrefix(texts: string[], prefix: string): Promise<number[][]> {
  if (texts.length === 0) return [];

  const ok = await ensureModel();
  if (!ok) {
    backend = 'hash-fallback';
    return texts.map(hashVector);
  }
  backend = 'e5-small';

  const fn = extractor as (
    input: string[],
    opts: { pooling: 'mean'; normalize: boolean }
  ) => Promise<{ tolist(): number[][] }>;

  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE).map((t) => prefix + t);
    const res = await fn(batch, { pooling: 'mean', normalize: true });
    out.push(...res.tolist());
  }
  return out;
}

/** 코퍼스/문서 임베딩 ("passage: " prefix) */
export async function embedDocuments(texts: string[]): Promise<number[][]> {
  return embedWithPrefix(texts, 'passage: ');
}

/** 질의 임베딩 ("query: " prefix) */
export async function embedQuery(text: string): Promise<number[]> {
  const r = await embedWithPrefix([text], 'query: ');
  return r[0];
}

/** 진행 상황 표시용 */
export function describeBackend(): string {
  if (backend === 'e5-small') return `${EMBED_MODEL_ID} (${EMBED_DIM}d)`;
  if (backend === 'hash-fallback') return `hash-fallback (${VECTOR_DIM}d)`;
  return 'not initialized';
}
