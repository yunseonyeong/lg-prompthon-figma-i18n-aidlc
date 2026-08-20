/**
 * 임베딩 모델 평가용 테스트셋
 *
 * 실제 Dev-B 업무에서 발생하는 검색 패턴을 반영한 정답 라벨셋.
 * expected = src/locales/en.json 에 존재하는 sourceText (정답)
 */

export interface TestCase {
  query: string;
  expected: string;
  category: 'exact' | 'typo' | 'synonym' | 'paraphrase' | 'cross-lingual' | 'domain-trap';
  note: string;
}

export const TEST_CASES: TestCase[] = [
  // ── 완전 일치: 최소 보장선 ──
  { query: 'License Policy', expected: 'License Policy', category: 'exact', note: '완전 일치' },
  { query: 'Business Site Name', expected: 'Business Site Name', category: 'exact', note: '완전 일치' },

  // ── 오타/변형: 추출 텍스트에 오타가 섞이는 상황 ──
  { query: 'Licence Policys', expected: 'License Policy', category: 'typo', note: '오타+복수형' },
  { query: 'buisness site adress', expected: 'Business Site Address', category: 'typo', note: '오타 2개' },

  // ── 동의어: 신규 Figma 텍스트가 다른 단어로 같은 뜻을 표현 ──
  { query: 'remove', expected: 'Delete', category: 'synonym', note: '삭제 동의어' },
  { query: 'revoke license', expected: 'Withdraw', category: 'synonym', note: '라이선스 회수' },
  { query: 'restart device', expected: 'Assign Device', category: 'synonym', note: '장치 관련(약한 라벨)' },

  // ── 의역: 같은 개념을 다른 표현으로 ──
  { query: 'industry category', expected: 'Vertical Type *', category: 'paraphrase', note: '산업 분야' },
  { query: 'renew subscription period', expected: 'Extend', category: 'paraphrase', note: '기간 연장' },
  { query: 'who owns this site', expected: 'End Customer', category: 'paraphrase', note: '최종 고객' },

  // ── 교차언어: Dev-B가 한국어로 검색하는 상황 ──
  { query: '라이선스 정책', expected: 'License Policy', category: 'cross-lingual', note: '한국어 질의' },
  { query: '장치 할당', expected: 'Assign Device', category: 'cross-lingual', note: '한국어 질의' },
  { query: '비즈니스 사이트 주소', expected: 'Business Site Address', category: 'cross-lingual', note: '한국어 질의' },
  { query: '산업 분야', expected: 'Vertical Type *', category: 'cross-lingual', note: '용어집 번역어로 검색' },
  { query: '단일 인증', expected: 'Single Sign-On (SSO)', category: 'cross-lingual', note: 'SSO 개념 검색' },

  // ── 도메인 함정: 표면이 비슷하지만 다른 것을 찾아야 함 ──
  { query: 'theme color setting', expected: 'Theme Color', category: 'domain-trap', note: '테마' },
  { query: 'time zone of the site', expected: 'Time Zone', category: 'domain-trap', note: '시간대' },
  { query: 'publish content', expected: 'Publish', category: 'domain-trap', note: '배포' },
];
