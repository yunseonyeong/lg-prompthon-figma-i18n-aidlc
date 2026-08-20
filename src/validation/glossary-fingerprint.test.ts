/**
 * 용어집 지문 테스트
 *
 * 용어집이 개정되면 이전 확정 판정이 무효가 되어야 합니다.
 * 이 검사가 없으면 옛 기준으로 확정된 항목이 계속 스킵되며 위반을 가립니다.
 */
import { describe, it, expect } from 'vitest';
import type { GlossaryData } from '../retrieval/glossary-loader.js';
import { glossaryFingerprint } from './glossary-fingerprint.js';

function g(overrides: Partial<GlossaryData> = {}): GlossaryData {
  return {
    entries: [
      { english: 'Device', context: '장치', ko: '디바이스', ja: 'デバイス', zhCN: '设备', category: '핵심' },
      { english: 'Space', context: '공간', ko: '스페이스', ja: 'スペース', zhCN: '空间', category: '메뉴' },
    ],
    productNames: ['Art Lounge'],
    excludePatterns: ['Business A'],
    ...overrides,
  };
}

describe('glossaryFingerprint', () => {
  it('같은 내용이면 같은 지문', () => {
    expect(glossaryFingerprint(g())).toBe(glossaryFingerprint(g()));
  });

  it('번역이 바뀌면 지문이 바뀐다', () => {
    const changed = g({
      entries: [
        { english: 'Device', context: '장치', ko: '장치', ja: 'デバイス', zhCN: '设备', category: '핵심' },
        { english: 'Space', context: '공간', ko: '스페이스', ja: 'スペース', zhCN: '空间', category: '메뉴' },
      ],
    });
    expect(glossaryFingerprint(changed)).not.toBe(glossaryFingerprint(g()));
  });

  it('Context 열만 바뀌면 지문이 유지된다 (판정에 영향 없음)', () => {
    const changed = g({
      entries: [
        { english: 'Device', context: '설명이 바뀜', ko: '디바이스', ja: 'デバイス', zhCN: '设备', category: '핵심' },
        { english: 'Space', context: '공간', ko: '스페이스', ja: 'スペース', zhCN: '空间', category: '메뉴' },
      ],
    });
    expect(glossaryFingerprint(changed)).toBe(glossaryFingerprint(g()));
  });

  it('제품명이 바뀌면 지문이 바뀐다', () => {
    expect(glossaryFingerprint(g({ productNames: ['Art Lounge', 'New Product'] })))
      .not.toBe(glossaryFingerprint(g()));
  });

  it('제외 패턴이 바뀌면 지문이 바뀐다', () => {
    expect(glossaryFingerprint(g({ excludePatterns: ['Business A', 'Label'] })))
      .not.toBe(glossaryFingerprint(g()));
  });

  it('용어 순서가 달라도 지문은 같다', () => {
    const reordered = g({ entries: [...g().entries].reverse() });
    expect(glossaryFingerprint(reordered)).toBe(glossaryFingerprint(g()));
  });
});
