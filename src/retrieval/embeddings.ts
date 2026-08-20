/**
 * 임베딩 유틸리티
 * - 로컬 해시 기반 벡터 생성 (외부 API 불필요)
 * - 간단한 TF 기반 벡터로 유사도 검색 가능
 *
 * 벡터 차원: 384 (sentence-transformers 호환 크기)
 */

const VECTOR_DIM = 384;

/**
 * 간단한 해시 함수 (문자열 → 숫자)
 */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32bit int
  }
  return hash;
}

/**
 * 텍스트를 토큰으로 분리 (공백 + 유니코드 기반)
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

/**
 * 텍스트 → 고정 차원 벡터 생성
 * 각 토큰의 해시로 벡터의 특정 위치에 값을 누적하고 정규화
 */
export function textToVector(text: string): number[] {
  const vector = new Float64Array(VECTOR_DIM);
  const tokens = tokenize(text);

  if (tokens.length === 0) {
    // 빈 텍스트 → 영벡터
    return Array.from(vector);
  }

  for (const token of tokens) {
    const h = Math.abs(hashCode(token));
    // 여러 위치에 분산
    for (let i = 0; i < 3; i++) {
      const pos = (h + i * 127) % VECTOR_DIM;
      const sign = (h >> (i + 1)) & 1 ? 1 : -1;
      vector[pos] += sign * (1 / tokens.length);
    }
    // n-gram 반영 (bigram)
    const bigramHash = Math.abs(hashCode(token + '_bg'));
    const biPos = bigramHash % VECTOR_DIM;
    vector[biPos] += 0.5 / tokens.length;
  }

  // L2 정규화
  let norm = 0;
  for (let i = 0; i < VECTOR_DIM; i++) {
    norm += vector[i] * vector[i];
  }
  norm = Math.sqrt(norm);

  if (norm > 0) {
    for (let i = 0; i < VECTOR_DIM; i++) {
      vector[i] /= norm;
    }
  }

  return Array.from(vector);
}

/**
 * 코사인 유사도 계산
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export { VECTOR_DIM, tokenize };
