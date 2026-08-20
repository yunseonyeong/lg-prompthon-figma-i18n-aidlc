/**
 * 에스컬레이션 판정 테스트 (US-2.4)
 */
import { describe, it, expect } from 'vitest';
import type { RejectedEntry } from '../retrieval/feedback-store.js';
import {
  findEscalations,
  escalationsToIssues,
  escalatedIds,
  renderEscalationReport,
  MAX_RETRIES,
} from './escalation.js';
import type { LocaleBundle } from './types.js';

function rej(round: number, wrong: string, layer = 2): RejectedEntry {
  return { key: 'x.term', locale: 'ko', wrong, reason: `사유 R${round}`, layer, round };
}

const BUNDLE: LocaleBundle = {
  en: { 'x.term': 'Vertical Type' },
  ko: { 'x.term': '세로 유형' },
};

describe('findEscalations', () => {
  it('상한 미달이면 에스컬레이션하지 않는다', () => {
    const rejected = { 'x.term::ko': [rej(1, 'A'), rej(2, '세로 유형')] };
    expect(findEscalations(BUNDLE, rejected)).toHaveLength(0);
  });

  it(`${MAX_RETRIES}회 도달하고 현재도 거부 상태면 에스컬레이션한다`, () => {
    const rejected = {
      'x.term::ko': [rej(1, 'A'), rej(2, 'B'), rej(3, '세로 유형')],
    };
    const e = findEscalations(BUNDLE, rejected);
    expect(e).toHaveLength(1);
    expect(e[0].attempts).toBe(3);
    expect(e[0].key).toBe('x.term');
    expect(e[0].sourceText).toBe('Vertical Type');
    expect(e[0].current).toBe('세로 유형');
    expect(e[0].attemptedTranslations).toEqual(['A', 'B', '세로 유형']);
    expect(e[0].firstRound).toBe(1);
    expect(e[0].lastRound).toBe(3);
  });

  it('3회 거부됐지만 지금은 고쳐졌으면 제외한다', () => {
    // 과거에 3번 틀렸어도 현재 번역이 거부 목록에 없으면 사람이 볼 필요가 없다
    const fixed: LocaleBundle = {
      en: { 'x.term': 'Vertical Type' },
      ko: { 'x.term': '산업 분야' },
    };
    const rejected = { 'x.term::ko': [rej(1, 'A'), rej(2, 'B'), rej(3, 'C')] };
    expect(findEscalations(fixed, rejected)).toHaveLength(0);
  });

  it('중복 사유와 중복 번역을 합친다', () => {
    const rejected = {
      'x.term::ko': [
        { ...rej(1, 'A'), reason: '같은 사유' },
        { ...rej(2, 'A'), reason: '같은 사유' },
        { ...rej(3, '세로 유형'), reason: '다른 사유' },
      ],
    };
    const e = findEscalations(BUNDLE, rejected);
    expect(e[0].attemptedTranslations).toEqual(['A', '세로 유형']);
    expect(e[0].reasons).toEqual(['같은 사유', '다른 사유']);
  });

  it('시도 횟수 내림차순으로 정렬한다', () => {
    const bundle: LocaleBundle = {
      en: { a: 'A', b: 'B' },
      ko: { a: 'x', b: 'y' },
    };
    const rejected = {
      'a::ko': [
        { key: 'a', locale: 'ko', wrong: 'x', reason: 'r', layer: 2, round: 1 },
        { key: 'a', locale: 'ko', wrong: 'x2', reason: 'r', layer: 2, round: 2 },
        { key: 'a', locale: 'ko', wrong: 'x', reason: 'r', layer: 2, round: 3 },
      ],
      'b::ko': [
        { key: 'b', locale: 'ko', wrong: 'y', reason: 'r', layer: 2, round: 1 },
        { key: 'b', locale: 'ko', wrong: 'y2', reason: 'r', layer: 2, round: 2 },
        { key: 'b', locale: 'ko', wrong: 'y3', reason: 'r', layer: 2, round: 3 },
        { key: 'b', locale: 'ko', wrong: 'y', reason: 'r', layer: 2, round: 4 },
      ],
    };
    const e = findEscalations(bundle, rejected);
    expect(e.map((x) => x.key)).toEqual(['b', 'a']);
  });
});

describe('escalationsToIssues', () => {
  it('FAIL 이슈로 변환하고 담당을 사람으로 표시한다', () => {
    const rejected = { 'x.term::ko': [rej(1, 'A'), rej(2, 'B'), rej(3, '세로 유형')] };
    const issues = escalationsToIssues(findEscalations(BUNDLE, rejected));
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('FAIL');
    expect(issues[0].layer).toBe(0);
    expect(issues[0].assignee).toContain('사람 검토');
    expect(issues[0].message).toContain('3회 재시도');
    expect(issues[0].rule).toContain('US-2.4');
  });
});

describe('escalatedIds', () => {
  it('자동 재번역 제외 대상 id를 만든다', () => {
    const rejected = { 'x.term::ko': [rej(1, 'A'), rej(2, 'B'), rej(3, '세로 유형')] };
    const ids = escalatedIds(findEscalations(BUNDLE, rejected));
    expect(ids.has('x.term::ko')).toBe(true);
  });
});

describe('renderEscalationReport', () => {
  it('대상이 없으면 안내 문구를 낸다', () => {
    expect(renderEscalationReport([])).toContain('에스컬레이션 대상이 없습니다');
  });

  it('대상 상세와 검토 포인트를 포함한다', () => {
    const rejected = { 'x.term::ko': [rej(1, 'A'), rej(2, 'B'), rej(3, '세로 유형')] };
    const md = renderEscalationReport(findEscalations(BUNDLE, rejected));
    expect(md).toContain('x.term');
    expect(md).toContain('Vertical Type');
    expect(md).toContain('시도된 번역');
    expect(md).toContain('용어집에 등재해야 하는 용어가 빠져 있다');
  });
});

describe('재시도 횟수 집계 (occurrences)', () => {
  it('같은 오역이 반복 제출되면 이력 1건이라도 시도 횟수로 센다', () => {
    // mergeRejected 가 중복 이력을 합치므로 history.length 만 보면
    // 상한에 영원히 도달하지 않는다. occurrences 를 합산해야 한다.
    const rejected = {
      'x.term::ko': [
        { key: 'x.term', locale: 'ko', wrong: '세로 유형', reason: 'r', layer: 2, round: 1, occurrences: 3, lastRound: 3 },
      ],
    };
    const e = findEscalations(BUNDLE, rejected);
    expect(e).toHaveLength(1);
    expect(e[0].attempts).toBe(3);
    expect(e[0].firstRound).toBe(1);
    expect(e[0].lastRound).toBe(3);
  });

  it('occurrences 가 없으면 1로 취급한다 (구버전 데이터 호환)', () => {
    const rejected = {
      'x.term::ko': [
        { key: 'x.term', locale: 'ko', wrong: 'A', reason: 'r', layer: 2, round: 1 },
        { key: 'x.term', locale: 'ko', wrong: 'B', reason: 'r', layer: 2, round: 2 },
      ],
    };
    expect(findEscalations(BUNDLE, rejected)).toHaveLength(0); // 2회 < 3
  });

  it('서로 다른 오역과 반복이 섞이면 합산한다', () => {
    const rejected = {
      'x.term::ko': [
        { key: 'x.term', locale: 'ko', wrong: 'A', reason: 'r', layer: 2, round: 1, occurrences: 2 },
        { key: 'x.term', locale: 'ko', wrong: '세로 유형', reason: 'r', layer: 3, round: 3, occurrences: 1 },
      ],
    };
    const e = findEscalations(BUNDLE, rejected);
    expect(e[0].attempts).toBe(3);
    expect(e[0].layers).toEqual([2, 3]);
  });
});
