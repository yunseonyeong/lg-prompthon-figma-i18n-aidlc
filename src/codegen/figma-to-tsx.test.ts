/**
 * Figma 구조 → tsx 생성 테스트
 *
 * 검증 대상은 "미리보기와 코드가 같은 규칙을 쓴다"는 주장이다.
 * FigmaFrameRenderer.test.tsx가 DOM 쪽에서 검증하는 규칙과 짝을 맞춘다:
 *   - 좌표가 있는 노드 → absolute + left/top + Figma 크기
 *   - 좌표가 없으면 Auto Layout(flex)로 폴백
 *   - TEXT는 height를 고정하지 않는다 (번역 오버플로)
 *   - i18n 키가 있으면 t(key), 없으면 원문 그대로
 *   - UX 문서 요소(No/Classification/Description 표, 장표 제목)는 제외
 */

import { describe, expect, it } from 'vitest';
import { componentNameFor, generateComponentTsx } from './figma-to-tsx';
import type { FigmaNodeView } from '../types/figma';

const SCREEN: FigmaNodeView = {
  id: '1:1',
  name: 'Console_Setting_Group@User',
  type: 'FRAME',
  layoutMode: 'none',
  width: 1245,
  height: 701,
  backgroundColor: '#FFFFFF',
  children: [
    {
      id: '1:2',
      name: 'Card',
      type: 'FRAME',
      layoutMode: 'none',
      x: 32,
      y: 64,
      width: 400,
      height: 200,
      backgroundColor: '#EFEFEF',
      borderRadius: '11.5px',
      children: [
        {
          id: '1:3',
          name: 'title',
          type: 'TEXT',
          layoutMode: 'none',
          x: 16,
          y: 12,
          width: 300,
          height: 32,
          fontSize: 24,
          text: 'Workspace/Group Settings',
          i18nKey: 'console.setting.group.title.workspaceGroupSettings',
        },
        {
          // 키가 없는 텍스트 (파이프라인이 번역 대상에서 제외한 것)
          id: '1:4',
          name: 'meta',
          type: 'TEXT',
          layoutMode: 'none',
          x: 16,
          y: 60,
          text: '2026-08-21',
        },
      ],
    },
    {
      // 좌표 없음 → flex 폴백
      id: '1:5',
      name: 'Toolbar',
      type: 'FRAME',
      layoutMode: 'row',
      gap: '5.189189434051514px',
      children: [
        {
          id: '1:6',
          name: 'btn',
          type: 'TEXT',
          layoutMode: 'none',
          text: 'Save',
          i18nKey: 'console.setting.group.button.save',
        },
      ],
    },
    {
      // 아이콘 path — 렌더에 기여하지 않으므로 코드에도 나오지 않아야 한다
      id: '1:7',
      name: 'icon',
      type: 'VECTOR',
      layoutMode: 'none',
      x: 500,
      y: 10,
    },
  ],
};

/** UX 시나리오 장표 래퍼: 실제 화면 + 문서 부속물 */
const DOC_WRAPPER: FigmaNodeView = {
  id: '0:1',
  name: '-',
  type: 'FRAME',
  layoutMode: 'none',
  width: 1920,
  height: 1703,
  children: [
    {
      id: '0:2',
      name: 'Table',
      type: 'FRAME',
      layoutMode: 'none',
      x: 1369,
      y: 126,
      children: [
        { id: '0:3', name: 'h1', type: 'TEXT', layoutMode: 'none', text: 'No' },
        { id: '0:4', name: 'h2', type: 'TEXT', layoutMode: 'none', text: 'Classification' },
        { id: '0:5', name: 'h3', type: 'TEXT', layoutMode: 'none', text: 'Description' },
      ],
    },
    { id: '0:6', name: 'Doc Title', type: 'TEXT', layoutMode: 'none', x: 0, y: 0, text: 'UX 시나리오' },
    SCREEN,
  ],
};

describe('generateComponentTsx', () => {
  const generated = generateComponentTsx(SCREEN, 'ConsoleSettingGroupUser');

  it('좌표가 있는 노드를 Figma px 그대로 absolute 배치한다', () => {
    expect(generated.code).toContain('position: "absolute"');
    expect(generated.code).toContain('left: "32px"');
    expect(generated.code).toContain('top: "64px"');
    expect(generated.code).toContain('width: "400px"');
    expect(generated.code).toContain('height: "200px"');
  });

  it('absolute 자식을 두는 컨테이너는 position:relative가 된다', () => {
    expect(generated.code).toContain('position: "relative"');
  });

  it('TEXT는 height를 고정하지 않는다 (번역이 길어져도 잘리지 않게)', () => {
    // 제목 노드는 height 32 → minHeight로만 나가야 한다
    expect(generated.code).toContain('minHeight: "32px"');
    expect(generated.code).not.toMatch(/fontSize: "24px"[^}]*height: "32px"/);
  });

  it('i18n 키가 있으면 t(key), 없으면 Figma 원문을 그대로 쓴다', () => {
    expect(generated.code).toContain('{t("console.setting.group.title.workspaceGroupSettings")}');
    expect(generated.code).toContain('{"2026-08-21"}');
    expect(generated.code).toContain("import { useTranslation } from 'react-i18next'");
  });

  it('좌표가 없는 노드는 Auto Layout(flex)으로 폴백하고 px는 정수로 다듬는다', () => {
    expect(generated.code).toContain('flexDirection: "row"');
    // 5.189189434051514px → 5px
    expect(generated.code).toContain('gap: "5px"');
    expect(generated.code).not.toContain('5.189189434051514');
  });

  it('아이콘 path(VECTOR)는 코드에 포함하지 않는다', () => {
    expect(generated.code).not.toContain('1:7');
  });

  it('컴포넌트 형태로 끝난다 (파일이 그대로 쓰일 수 있어야 한다)', () => {
    expect(generated.fileName).toBe('ConsoleSettingGroupUser.tsx');
    expect(generated.code).toContain('function ConsoleSettingGroupUser()');
    expect(generated.code.trimEnd().endsWith('export default ConsoleSettingGroupUser;')).toBe(true);
  });

  it('노드/텍스트/키 개수를 집계한다', () => {
    expect(generated.stats.texts).toBe(3);
    expect(generated.stats.mappedKeys).toBe(2);
  });
});

describe('generateComponentTsx — UX 문서 요소 제외', () => {
  it('설명 표와 장표 제목을 코드에서 제외한다', () => {
    const generated = generateComponentTsx(DOC_WRAPPER, 'Screen');
    // No/Classification/Description 표와 장표 제목은 UI가 아니다
    expect(generated.code).not.toContain('Classification');
    expect(generated.code).not.toContain('Description');
    expect(generated.code).not.toContain('UX 시나리오');
    // 화면 안의 텍스트는 남는다
    expect(generated.code).toContain('console.setting.group.title.workspaceGroupSettings');
  });

  it('화면 프레임이 장표의 대부분을 차지하면 그 프레임을 루트로 삼는다', () => {
    // 실측 비율(1,360/1,423 = 96%)을 재현: 화면에 노드를 채워 지배적으로 만든다
    const bulkyScreen: FigmaNodeView = {
      ...SCREEN,
      children: [
        ...(SCREEN.children ?? []),
        ...Array.from({ length: 30 }, (_, i) => ({
          id: `bulk:${i}`,
          name: `row${i}`,
          type: 'TEXT',
          layoutMode: 'none' as const,
          text: `row ${i}`,
        })),
      ],
    };
    const generated = generateComponentTsx(
      { ...DOC_WRAPPER, children: [DOC_WRAPPER.children![0], DOC_WRAPPER.children![1], bulkyScreen] },
      'Screen'
    );
    expect(generated.frame).toBe('Console_Setting_Group@User');
    expect(generated.code).not.toContain('Classification');
  });

  it('stripDocNodes=false면 장표 전체를 그대로 코드로 만든다', () => {
    const generated = generateComponentTsx(DOC_WRAPPER, 'Screen', { stripDocNodes: false });
    expect(generated.frame).toBe('-');
    expect(generated.code).toContain('Classification');
  });
});

describe('componentNameFor', () => {
  it('프레임 이름을 PascalCase로 바꾼다', () => {
    expect(componentNameFor(SCREEN)).toBe('ConsoleSettingGroupUser');
  });

  it('이름에 영숫자가 없으면 노드 id로 대체한다', () => {
    // "-" → 빈 문자열이 되어 .tsx 숨김 파일이 만들어지던 버그 방지
    expect(componentNameFor({ ...SCREEN, name: '-', id: '15682:100905' })).toBe('Frame15682_100905');
  });
});
