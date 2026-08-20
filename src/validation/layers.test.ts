/**
 * 4계층 검증 규칙 테스트
 *
 * 파일 I/O가 없는 순수 함수라 픽스처를 직접 구성해 검증합니다.
 */
import { describe, it, expect } from 'vitest';
import type { GlossaryData } from '../retrieval/glossary-loader.js';
import {
  flattenJson,
  containsTerm,
  extractPlaceholders,
  isExcludedSource,
  checkLayer1,
  checkLayer2,
  checkLayer3,
  checkLayer4,
  checkSourceQuality,
  runAllLayers,
} from './layers.js';
import type { LocaleBundle } from './types.js';

const GLOSSARY: GlossaryData = {
  entries: [
    { english: 'Workspace', context: '작업 단위', ko: '워크스페이스', ja: 'ワークスペース', zhCN: '工作区', category: '핵심' },
    { english: 'Space', context: '공간 메뉴', ko: '공간', ja: 'スペース', zhCN: '空间', category: '메뉴' },
    { english: 'Group', context: '묶음', ko: '그룹', ja: 'グループ', zhCN: '组', category: '핵심' },
    { english: 'Extend', context: '기간 연장', ko: '연장', ja: '延長', zhCN: '延长', category: '라이선스' },
    { english: 'Withdraw', context: '라이선스 회수', ko: '회수', ja: '回収', zhCN: '回收', category: '라이선스' },
    { english: 'Vertical Type', context: '업종 분류', ko: '버티컬 타입', ja: '業種', zhCN: '行业类型', category: '비즈니스' },
  ],
  productNames: ['Art Lounge', 'LG Electronics'],
  excludePatterns: ['Business A', 'supporting text', 'Label'],
};

describe('flattenJson', () => {
  it('중첩 객체를 dot 경로로 평탄화한다', () => {
    const r = flattenJson({ a: { b: { c: 'x' } }, d: 'y' });
    expect(r).toEqual({ 'a.b.c': 'x', d: 'y' });
  });

  it('문자열이 아닌 값은 제외한다', () => {
    const r = flattenJson({ a: 1, b: 'ok', c: null });
    expect(r).toEqual({ b: 'ok' });
  });
});

describe('containsTerm', () => {
  it('단어 단위로만 매칭한다', () => {
    expect(containsTerm('Space', 'Space')).toBe(true);
    expect(containsTerm('Space Settings', 'Space')).toBe(true);
    // "Workspace" 안의 "space"는 매칭되지 않아야 한다
    expect(containsTerm('Workspace/Group Settings', 'Space')).toBe(false);
    expect(containsTerm('Workspace/Group Settings', 'Workspace')).toBe(true);
    expect(containsTerm('Workspace/Group Settings', 'Group')).toBe(true);
  });

  it('대소문자를 구분하지 않는다', () => {
    expect(containsTerm('workspace settings', 'Workspace')).toBe(true);
  });

  it('정규식 특수문자가 든 용어를 안전하게 처리한다', () => {
    expect(containsTerm('C++ Guide', 'C++')).toBe(true);
    expect(() => containsTerm('x', '(')).not.toThrow();
  });
});

describe('extractPlaceholders', () => {
  it('여러 형식의 placeholder를 추출한다', () => {
    expect(extractPlaceholders('Hello {{name}}, you have {0} items')).toEqual(['{{name}}', '{0}']);
    expect(extractPlaceholders('no placeholder')).toEqual([]);
  });
});

describe('isExcludedSource', () => {
  it('제외 패턴을 포함하면 true', () => {
    expect(isExcludedSource('Business A', GLOSSARY.excludePatterns)).toBe(true);
    expect(isExcludedSource('Business Site Name', GLOSSARY.excludePatterns)).toBe(false);
  });
});

describe('checkLayer1', () => {
  it('key 누락을 검출한다', () => {
    const bundle: LocaleBundle = {
      en: { 'a.b': 'Save', 'a.c': 'Delete' },
      ko: { 'a.b': '저장' },
    };
    const issues = checkLayer1(bundle);
    expect(issues).toHaveLength(1);
    expect(issues[0].key).toBe('a.c');
    expect(issues[0].severity).toBe('FAIL');
    expect(issues[0].assignee).toBe('Dev-A');
  });

  it('초과 key를 검출한다', () => {
    const bundle: LocaleBundle = {
      en: { 'a.b': 'Save' },
      ko: { 'a.b': '저장', 'a.z': '없음' },
    };
    const issues = checkLayer1(bundle);
    expect(issues.some((i) => i.key === 'a.z' && i.message.includes('초과'))).toBe(true);
  });

  it('placeholder 손실을 검출한다', () => {
    const bundle: LocaleBundle = {
      en: { 'a.b': 'Hello {{name}}' },
      ko: { 'a.b': '안녕하세요' },
    };
    const issues = checkLayer1(bundle);
    expect(issues.some((i) => i.message.includes('Placeholder 손실'))).toBe(true);
  });

  it('정상 번역은 이슈가 없다', () => {
    const bundle: LocaleBundle = {
      en: { 'a.b': 'Hello {{name}}' },
      ko: { 'a.b': '안녕하세요 {{name}}' },
    };
    expect(checkLayer1(bundle)).toHaveLength(0);
  });
});

describe('checkLayer2', () => {
  it('제품명 번역을 FAIL로 잡는다', () => {
    const bundle: LocaleBundle = {
      en: { 'x.art': 'Art Lounge' },
      ko: { 'x.art': '아트 라운지' },
    };
    const issues = checkLayer2(bundle, GLOSSARY);
    const hit = issues.find((i) => i.severity === 'FAIL');
    expect(hit).toBeDefined();
    expect(hit?.rule).toBe('glossary §7');
  });

  it('제품명을 원문 유지하면 통과한다', () => {
    const bundle: LocaleBundle = {
      en: { 'x.art': 'Art Lounge' },
      ko: { 'x.art': 'Art Lounge' },
    };
    expect(checkLayer2(bundle, GLOSSARY).filter((i) => i.severity === 'FAIL')).toHaveLength(0);
  });

  it('등록 용어 불일치를 WARN으로 잡는다', () => {
    const bundle: LocaleBundle = {
      en: { 'x.ws': 'Workspace Settings' },
      ko: { 'x.ws': '작업 공간 설정' }, // 워크스페이스가 아님
    };
    const issues = checkLayer2(bundle, GLOSSARY);
    expect(issues.some((i) => i.severity === 'WARN' && i.expected === '워크스페이스')).toBe(true);
  });

  it('복합어 내부 용어를 인정한다 (§8-2)', () => {
    const bundle: LocaleBundle = {
      en: { 'x.ws': 'Workspace/Group Settings' },
      ko: { 'x.ws': '워크스페이스/그룹 설정' },
    };
    const issues = checkLayer2(bundle, GLOSSARY);
    // Workspace, Group 모두 충족 → 위반 없음
    expect(issues).toHaveLength(0);
  });

  it('Workspace 안의 Space를 오탐하지 않는다', () => {
    const bundle: LocaleBundle = {
      en: { 'x.ws': 'Workspace/Group Settings' },
      ko: { 'x.ws': '워크스페이스/그룹 설정' },
    };
    const issues = checkLayer2(bundle, GLOSSARY);
    // "공간"이 없다는 이유로 위반이 잡히면 오탐
    expect(issues.some((i) => i.expected === '공간')).toBe(false);
  });

  it('버튼의 "끔" 표기를 WARN으로 잡는다 (§6)', () => {
    const bundle: LocaleBundle = {
      en: { 'x.button.off': 'Off' },
      ko: { 'x.button.off': '끔' },
    };
    const issues = checkLayer2(bundle, GLOSSARY);
    expect(issues.some((i) => i.rule === 'glossary §6')).toBe(true);
  });
});

describe('checkLayer3', () => {
  it('라이선스 맥락의 Extend 오역을 잡는다', () => {
    const bundle: LocaleBundle = {
      en: { 'x.ext': 'Extend' },
      ko: { 'x.ext': '확장' },
    };
    const issues = checkLayer3(bundle, GLOSSARY);
    expect(issues).toHaveLength(1);
    expect(issues[0].expected).toBe('연장');
    expect(issues[0].assignee).toBe('Dev-B → Dev-A');
  });

  it('올바른 번역은 통과한다', () => {
    const bundle: LocaleBundle = {
      en: { 'x.ext': 'Extend' },
      ko: { 'x.ext': '연장' },
    };
    expect(checkLayer3(bundle, GLOSSARY)).toHaveLength(0);
  });

  it('Vertical 오역을 잡는다', () => {
    const bundle: LocaleBundle = {
      en: { 'x.v': 'Vertical Type' },
      ko: { 'x.v': '세로 유형' },
    };
    expect(checkLayer3(bundle, GLOSSARY).some((i) => i.expected === '버티컬 타입')).toBe(true);
  });

  it('용어집이 없으면 검사하지 않는다 (기대 번역을 얻을 수 없음)', () => {
    const bundle: LocaleBundle = {
      en: { 'x.ext': 'Extend' },
      ko: { 'x.ext': '확장' },
    };
    expect(checkLayer3(bundle)).toHaveLength(0);
  });

  it('기대 번역을 용어집에서 조회한다 (하드코딩 아님)', () => {
    // 용어집이 개정되면 기대값도 따라 바뀌어야 한다
    const revised: GlossaryData = {
      ...GLOSSARY,
      entries: GLOSSARY.entries.map((e) =>
        e.english === 'Vertical Type' ? { ...e, ko: '산업 분야' } : e
      ),
    };
    const bundle: LocaleBundle = {
      en: { 'x.v': 'Vertical Type' },
      ko: { 'x.v': '세로 유형' },
    };
    const issues = checkLayer3(bundle, revised);
    expect(issues[0].expected).toBe('산업 분야');
  });
});

describe('checkLayer4', () => {
  it('제외 대상이 번역되면 FAIL', () => {
    const bundle: LocaleBundle = {
      en: { 'x.b': 'Business A' },
      ko: { 'x.b': '비즈니스 A' },
    };
    const issues = checkLayer4(bundle, GLOSSARY);
    expect(issues).toHaveLength(1);
    expect(issues[0].assignee).toBe('Dev-A (추출 필터)');
  });

  it('번역되지 않았어도 제외 대상은 검출한다', () => {
    // 검증 명세: 애초에 추출되면 안 됐던 항목이므로 번역 여부와 무관하다.
    // 번역만 안 됐다고 통과시키면 추출 필터가 고쳐지지 않아 매 라운드 재등장한다.
    const bundle: LocaleBundle = {
      en: { 'x.b': 'Business A' },
      ko: { 'x.b': 'Business A' },
    };
    const issues = checkLayer4(bundle, GLOSSARY);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('추출됨');
    expect(issues[0].expected).toBe('(추출 제외)');
    expect(issues[0].assignee).toBe('Dev-A (추출 필터)');
  });

  it('제외 대상이 아니면 검출하지 않는다', () => {
    const bundle: LocaleBundle = {
      en: { 'x.n': 'Business Site Name' },
      ko: { 'x.n': '비즈니스 사이트 이름' },
    };
    expect(checkLayer4(bundle, GLOSSARY)).toHaveLength(0);
  });
});

describe('checkSourceQuality', () => {
  it('원문 오타를 INFO로 보고한다', () => {
    const bundle: LocaleBundle = { en: { 'x.s': 'Set the detailes here' } };
    const issues = checkSourceQuality(bundle);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('INFO');
    expect(issues[0].assignee).toBe('디자이너');
  });
});

describe('runAllLayers', () => {
  it('skipKeys로 지정한 항목을 제외한다', () => {
    const bundle: LocaleBundle = {
      en: { 'x.art': 'Art Lounge', 'x.b': 'Business A' },
      ko: { 'x.art': '아트 라운지', 'x.b': '비즈니스 A' },
    };
    const all = runAllLayers(bundle, GLOSSARY);
    expect(all.length).toBeGreaterThan(0);

    const skipped = runAllLayers(bundle, GLOSSARY, {
      skipKeys: new Set(['x.art::ko', 'x.b::ko']),
    });
    expect(skipped).toHaveLength(0);
  });
});
