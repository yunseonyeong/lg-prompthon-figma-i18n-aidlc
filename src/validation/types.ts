/**
 * 검증 타입 정의
 *
 * 계층별로 담당자가 다르므로 Issue에 assignee를 포함합니다.
 * (검증 명세 aidlc-docs/construction/build-and-test/i18n-verification-spec.md)
 */

/** 0 = 사전 차단(축적된 피드백 기반), 1~4 = 4계층 검증 */
export type Layer = 0 | 1 | 2 | 3 | 4;

export type Severity = 'FAIL' | 'WARN' | 'INFO';

/** 사전 차단 유형 */
export type BlockKind = 'regression' | 'recurrence' | 'unfixed-exclusion';

export interface Issue {
  layer: Layer;
  severity: Severity;
  key: string;
  locale: string;
  message: string;
  /** 이 문제를 고칠 사람 */
  assignee: string;
  /** 규칙 출처 (예: 'glossary §7') */
  rule?: string;
  /** 사전 차단인 경우 유형 */
  blockKind?: BlockKind;
  /** 문제가 된 실제 값 */
  actual?: string;
  /** 기대값 (알 수 있는 경우) */
  expected?: string;
}

/** locale 코드 → flat key/value 맵 */
export type LocaleBundle = Record<string, Record<string, string>>;

export const LAYER_NAMES: Record<Layer, string> = {
  0: 'Layer 0: 사전 차단 (축적된 피드백)',
  1: 'Layer 1: 구조적 결함',
  2: 'Layer 2: 용어집 위반',
  3: 'Layer 3: 문맥 오역',
  4: 'Layer 4: 번역 제외 대상',
};

export const ASSIGNEES = {
  devA: 'Dev-A',
  devAExtract: 'Dev-A (추출 필터)',
  devAB: 'Dev-A / Dev-B',
  devB: 'Dev-B',
  devBtoA: 'Dev-B → Dev-A',
  designer: '디자이너',
} as const;
