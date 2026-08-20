/**
 * 사전 차단 및 라운드 루프 테스트
 *
 * 자가발전이 실제로 작동하는지 — 라운드를 거치며 검증 대상이 줄고
 * 회귀/재발이 차단되는지 — 를 검증합니다.
 */
import { describe, it, expect } from 'vitest';
import type { GlossaryData } from '../retrieval/glossary-loader.js';
import {
  checkPreBlock,
  selectConfirmable,
  collectRejections,
  collectExclusions,
  mergeRejected,
  type FeedbackState,
} from './preblock.js';
import { evaluateRound } from './round.js';
import { discoverTermCandidates, findRepeatedViolations } from './glossary-growth.js';
import type { Issue, LocaleBundle } from './types.js';

const GLOSSARY: GlossaryData = {
  entries: [
    { english: 'Workspace', context: '작업 단위', ko: '워크스페이스', ja: 'ワークスペース', zhCN: '工作区', category: '핵심' },
    { english: 'Extend', context: '기간 연장', ko: '연장', ja: '延長', zhCN: '延长', category: '라이선스' },
  ],
  productNames: ['Art Lounge'],
  excludePatterns: ['Business A'],
};

function emptyFeedback(): FeedbackState {
  return { confirmed: {}, rejected: {}, exclusions: {} };
}

/** ko/ja/zh-CN 모두 올바른 번역 묶음 */
function goodBundle(): LocaleBundle {
  return {
    en: { 'x.save': 'Save', 'x.ws': 'Workspace' },
    ko: { 'x.save': '저장', 'x.ws': '워크스페이스' },
    ja: { 'x.save': '保存', 'x.ws': 'ワークスペース' },
    'zh-CN': { 'x.save': '保存', 'x.ws': '工作区' },
  };
}

describe('checkPreBlock', () => {
  it('확정본과 동일하면 검증을 건너뛴다', () => {
    const bundle = goodBundle();
    const feedback = emptyFeedback();
    feedback.confirmed['x.save::ko'] = {
      key: 'x.save',
      locale: 'ko',
      sourceText: 'Save',
      translation: '저장',
      confirmedAtRound: 1,
      verifiedBy: ['layer1'],
    };

    const r = checkPreBlock(bundle, feedback);
    expect(r.skipIds.has('x.save::ko')).toBe(true);
    expect(r.counts.matchedConfirmed).toBe(1);
    expect(r.counts.regressions).toBe(0);
    expect(r.issues).toHaveLength(0);
  });

  it('확정본이 바뀌면 회귀로 잡는다', () => {
    const bundle = goodBundle();
    bundle.ko['x.save'] = '세이브'; // 변경됨
    const feedback = emptyFeedback();
    feedback.confirmed['x.save::ko'] = {
      key: 'x.save',
      locale: 'ko',
      sourceText: 'Save',
      translation: '저장',
      confirmedAtRound: 1,
      verifiedBy: ['layer1'],
    };

    const r = checkPreBlock(bundle, feedback);
    expect(r.counts.regressions).toBe(1);
    const issue = r.issues.find((i) => i.blockKind === 'regression');
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe('FAIL');
    expect(issue?.expected).toBe('저장');
    expect(issue?.actual).toBe('세이브');
    expect(r.skipIds.has('x.save::ko')).toBe(false);
  });

  it('과거 거부된 번역이 다시 오면 재발로 잡는다', () => {
    const bundle = goodBundle();
    bundle.ko['x.ws'] = '작업 공간'; // 과거 거부된 값
    const feedback = emptyFeedback();
    feedback.rejected['x.ws::ko'] = [
      {
        key: 'x.ws',
        locale: 'ko',
        wrong: '작업 공간',
        reason: '용어 불일치',
        layer: 2,
        round: 1,
        correct: '워크스페이스',
      },
    ];

    const r = checkPreBlock(bundle, feedback);
    expect(r.counts.recurrences).toBe(1);
    const issue = r.issues.find((i) => i.blockKind === 'recurrence');
    expect(issue?.severity).toBe('FAIL');
    expect(issue?.expected).toBe('워크스페이스');
  });

  it('추출 제외 항목이 여전히 번역되면 미수정으로 잡는다', () => {
    const bundle: LocaleBundle = {
      en: { 'x.biz': 'Business A' },
      ko: { 'x.biz': '비즈니스 A' },
      ja: { 'x.biz': 'Business A' },
      'zh-CN': { 'x.biz': 'Business A' },
    };
    const feedback = emptyFeedback();
    feedback.exclusions['x.biz'] = {
      key: 'x.biz',
      sourceText: 'Business A',
      reason: 'glossary §9',
      round: 1,
    };

    const r = checkPreBlock(bundle, feedback);
    expect(r.counts.unfixedExclusions).toBe(1);
    expect(r.issues[0].blockKind).toBe('unfixed-exclusion');
  });

  it('추출 제외 항목이 원문 유지되면 통과한다', () => {
    const bundle: LocaleBundle = {
      en: { 'x.biz': 'Business A' },
      ko: { 'x.biz': 'Business A' },
      ja: { 'x.biz': 'Business A' },
      'zh-CN': { 'x.biz': 'Business A' },
    };
    const feedback = emptyFeedback();
    feedback.exclusions['x.biz'] = {
      key: 'x.biz',
      sourceText: 'Business A',
      reason: 'glossary §9',
      round: 1,
    };
    expect(checkPreBlock(bundle, feedback).counts.unfixedExclusions).toBe(0);
  });
});

describe('selectConfirmable', () => {
  it('문제없는 항목만 확정한다', () => {
    const bundle = goodBundle();
    const issues: Issue[] = [
      { layer: 2, severity: 'FAIL', key: 'x.ws', locale: 'ko', message: 'bad', assignee: 'Dev-A' },
    ];
    const confirmed = selectConfirmable(bundle, issues, 1, {});

    expect(confirmed['x.save::ko']).toBeDefined();
    expect(confirmed['x.ws::ko']).toBeUndefined();   // FAIL이므로 제외
    expect(confirmed['x.ws::ja']).toBeDefined();     // 다른 locale은 정상
  });

  it('INFO는 확정을 막지 않는다', () => {
    const bundle = goodBundle();
    const issues: Issue[] = [
      { layer: 3, severity: 'INFO', key: 'x.save', locale: 'en', message: 'typo', assignee: '디자이너' },
    ];
    const confirmed = selectConfirmable(bundle, issues, 1, {});
    expect(confirmed['x.save::ko']).toBeDefined();
  });

  it('이미 확정된 항목의 라운드 정보를 유지한다', () => {
    const bundle = goodBundle();
    const prev = {
      'x.save::ko': {
        key: 'x.save',
        locale: 'ko',
        sourceText: 'Save',
        translation: '저장',
        confirmedAtRound: 1,
        verifiedBy: ['layer1'],
      },
    };
    const confirmed = selectConfirmable(bundle, [], 5, prev);
    expect(confirmed['x.save::ko'].confirmedAtRound).toBe(1); // 5가 아님
  });
});

describe('collectRejections', () => {
  it('FAIL 이슈를 거부 이력으로 변환한다', () => {
    const issues: Issue[] = [
      {
        layer: 2, severity: 'FAIL', key: 'x.art', locale: 'ko',
        message: '제품명 번역 금지', assignee: 'Dev-A',
        actual: '아트 라운지', expected: 'Art Lounge', rule: 'glossary §7',
      },
    ];
    const r = collectRejections(issues, 3);
    expect(r['x.art::ko']).toHaveLength(1);
    expect(r['x.art::ko'][0].wrong).toBe('아트 라운지');
    expect(r['x.art::ko'][0].round).toBe(3);
    expect(r['x.art::ko'][0].correct).toBe('Art Lounge');
  });

  it('사전 차단(layer 0)은 다시 쌓지 않는다', () => {
    const issues: Issue[] = [
      { layer: 0, severity: 'FAIL', key: 'x', locale: 'ko', message: 'm', assignee: 'Dev-A', actual: 'v' },
    ];
    expect(Object.keys(collectRejections(issues, 1))).toHaveLength(0);
  });

  it('actual이 없는 이슈는 제외한다', () => {
    const issues: Issue[] = [
      { layer: 1, severity: 'FAIL', key: 'x', locale: 'ko', message: 'key 누락', assignee: 'Dev-A' },
    ];
    expect(Object.keys(collectRejections(issues, 1))).toHaveLength(0);
  });
});

describe('mergeRejected', () => {
  it('중복 이력을 쌓지 않는다', () => {
    const existing = {
      'a::ko': [{ key: 'a', locale: 'ko', wrong: 'X', reason: 'r', layer: 2, round: 1 }],
    };
    const incoming = {
      'a::ko': [{ key: 'a', locale: 'ko', wrong: 'X', reason: 'r', layer: 2, round: 2 }],
    };
    expect(mergeRejected(existing, incoming)['a::ko']).toHaveLength(1);
  });

  it('다른 번역문은 추가한다', () => {
    const existing = {
      'a::ko': [{ key: 'a', locale: 'ko', wrong: 'X', reason: 'r', layer: 2, round: 1 }],
    };
    const incoming = {
      'a::ko': [{ key: 'a', locale: 'ko', wrong: 'Y', reason: 'r', layer: 2, round: 2 }],
    };
    expect(mergeRejected(existing, incoming)['a::ko']).toHaveLength(2);
  });
});

describe('collectExclusions', () => {
  it('Layer 4 이슈만 제외 목록으로 만든다', () => {
    const bundle: LocaleBundle = { en: { 'x.b': 'Business A' } };
    const issues: Issue[] = [
      { layer: 4, severity: 'FAIL', key: 'x.b', locale: 'ko', message: 'm', assignee: 'Dev-A (추출 필터)' },
      { layer: 2, severity: 'FAIL', key: 'x.c', locale: 'ko', message: 'm', assignee: 'Dev-A' },
    ];
    const r = collectExclusions(bundle, issues, 2);
    expect(Object.keys(r)).toEqual(['x.b']);
    expect(r['x.b'].sourceText).toBe('Business A');
  });
});

describe('evaluateRound — 자가발전 검증', () => {
  it('1라운드: 모두 검증하고 정상 항목을 확정한다', () => {
    const bundle = goodBundle();
    const r = evaluateRound(bundle, GLOSSARY, emptyFeedback(), 1);

    expect(r.metrics.round).toBe(1);
    expect(r.metrics.skipped).toBe(0);
    expect(r.metrics.checked).toBe(6); // 2 key × 3 locale
    expect(r.metrics.confirmedTotal).toBe(6);
  });

  it('2라운드: 확정 항목을 건너뛰어 검증 대상이 줄어든다', () => {
    const bundle = goodBundle();
    const r1 = evaluateRound(bundle, GLOSSARY, emptyFeedback(), 1);

    const feedback: FeedbackState = {
      confirmed: r1.nextConfirmed,
      rejected: r1.nextRejected,
      exclusions: r1.nextExclusions,
    };
    const r2 = evaluateRound(bundle, GLOSSARY, feedback, 2);

    expect(r2.metrics.skipped).toBe(6);
    expect(r2.metrics.checked).toBe(0);
    expect(r2.metrics.checked).toBeLessThan(r1.metrics.checked);
  });

  it('FAIL이 있으면 확정되지 않고, 고치면 다음 라운드에 확정된다', () => {
    const bad: LocaleBundle = {
      en: { 'x.art': 'Art Lounge' },
      ko: { 'x.art': '아트 라운지' },
      ja: { 'x.art': 'Art Lounge' },
      'zh-CN': { 'x.art': 'Art Lounge' },
    };

    const r1 = evaluateRound(bad, GLOSSARY, emptyFeedback(), 1);
    expect(r1.metrics.fail).toBeGreaterThan(0);
    expect(r1.nextConfirmed['x.art::ko']).toBeUndefined();

    // 수정
    const fixed: LocaleBundle = JSON.parse(JSON.stringify(bad));
    fixed.ko['x.art'] = 'Art Lounge';

    const r2 = evaluateRound(fixed, GLOSSARY, {
      confirmed: r1.nextConfirmed,
      rejected: r1.nextRejected,
      exclusions: r1.nextExclusions,
    }, 2);

    expect(r2.metrics.fail).toBe(0);
    expect(r2.nextConfirmed['x.art::ko']).toBeDefined();
    expect(r2.nextConfirmed['x.art::ko'].confirmedAtRound).toBe(2);
  });

  it('한번 거부된 번역이 재제출되면 재발로 차단한다', () => {
    const bad: LocaleBundle = {
      en: { 'x.art': 'Art Lounge' },
      ko: { 'x.art': '아트 라운지' },
      ja: { 'x.art': 'Art Lounge' },
      'zh-CN': { 'x.art': 'Art Lounge' },
    };

    const r1 = evaluateRound(bad, GLOSSARY, emptyFeedback(), 1);
    // 같은 잘못된 번역을 다시 제출
    const r2 = evaluateRound(bad, GLOSSARY, {
      confirmed: r1.nextConfirmed,
      rejected: r1.nextRejected,
      exclusions: r1.nextExclusions,
    }, 2);

    expect(r2.metrics.recurrences).toBeGreaterThan(0);
    expect(r2.issues.some((i) => i.blockKind === 'recurrence')).toBe(true);
  });

  it('확정 후 값이 바뀌면 회귀로 차단한다', () => {
    const bundle = goodBundle();
    const r1 = evaluateRound(bundle, GLOSSARY, emptyFeedback(), 1);

    const drifted: LocaleBundle = JSON.parse(JSON.stringify(bundle));
    drifted.ko['x.save'] = '저장하기'; // LLM 출력 흔들림

    const r2 = evaluateRound(drifted, GLOSSARY, {
      confirmed: r1.nextConfirmed,
      rejected: r1.nextRejected,
      exclusions: r1.nextExclusions,
    }, 2);

    expect(r2.metrics.regressions).toBe(1);
    expect(r2.metrics.fail).toBeGreaterThan(0);
  });
});

describe('glossary-growth', () => {
  it('여러 key에 반복 등장하는 미등록 표현을 후보로 제안한다', () => {
    const bundle: LocaleBundle = {
      en: { 'a.filter': 'Filter', 'b.filter': 'Filter', 'c.x': 'Unique' },
      ko: { 'a.filter': '필터', 'b.filter': '필터', 'c.x': '고유' },
      ja: { 'a.filter': 'フィルター', 'b.filter': 'フィルター', 'c.x': '固有' },
      'zh-CN': { 'a.filter': '筛选', 'b.filter': '筛选', 'c.x': '唯一' },
    };
    const p = discoverTermCandidates(bundle, GLOSSARY, 1, {});
    expect(p['Filter']).toBeDefined();
    expect(p['Filter'].occurrences).toBe(2);
    expect(p['Filter'].ko).toBe('필터');
    expect(p['Filter'].status).toBe('proposed');
    // 1회만 등장한 것은 제안하지 않는다
    expect(p['Unique']).toBeUndefined();
  });

  it('이미 등록된 용어는 제안하지 않는다', () => {
    const bundle: LocaleBundle = {
      en: { 'a.ws': 'Workspace', 'b.ws': 'Workspace' },
      ko: { 'a.ws': '워크스페이스', 'b.ws': '워크스페이스' },
    };
    expect(discoverTermCandidates(bundle, GLOSSARY, 1, {})['Workspace']).toBeUndefined();
  });

  it('승인/거부된 제안은 재제안하지 않는다', () => {
    const bundle: LocaleBundle = {
      en: { 'a.f': 'Filter', 'b.f': 'Filter' },
      ko: { 'a.f': '필터', 'b.f': '필터' },
    };
    const existing = {
      Filter: {
        english: 'Filter', context: '', ko: '필터', ja: '', 'zh-CN': '',
        evidence: [], occurrences: 2, firstSeenRound: 1, status: 'approved' as const,
      },
    };
    const p = discoverTermCandidates(bundle, GLOSSARY, 2, existing);
    expect(p['Filter'].status).toBe('approved');
  });

  it('반복 위반 용어를 집계한다', () => {
    const issues: Issue[] = [
      { layer: 2, severity: 'WARN', key: 'a', locale: 'ko', message: '용어 불일치: "Workspace" → 기대 "워크스페이스"', assignee: 'x' },
      { layer: 2, severity: 'WARN', key: 'b', locale: 'ko', message: '용어 불일치: "Workspace" → 기대 "워크스페이스"', assignee: 'x' },
      { layer: 2, severity: 'WARN', key: 'c', locale: 'ko', message: '용어 불일치: "Group" → 기대 "그룹"', assignee: 'x' },
    ];
    const rv = findRepeatedViolations(issues);
    expect(rv[0].term).toBe('Workspace');
    expect(rv[0].count).toBe(2);
    // 1건만 위반한 Group은 제외
    expect(rv.find((x) => x.term === 'Group')).toBeUndefined();
  });
});
