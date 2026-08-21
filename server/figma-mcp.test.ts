/**
 * Figma 구조 정규화 테스트
 *
 * Figma API가 429일 때도 MCP simplified / REST raw → FigmaNodeView 변환이
 * 깨지지 않는지 확인한다. 두 형식 모두 동일한 렌더 가능 구조로 수렴해야 한다.
 */

import { describe, expect, it } from 'vitest';
import { applyI18nKeys, normalizeMcpNode, normalizeRestNode } from './figma-mcp';

// figma-developer-mcp가 OUTPUT_FORMAT=json으로 내려주는 simplified 형태.
// layout / textStyle / fills는 globalVars.styles 참조로 압축되어 있다.
const MCP_STYLES = {
  layout_ROOT: {
    mode: 'column',
    sizing: { horizontal: 'fixed', vertical: 'fixed' },
    dimensions: { width: 1440, height: 900 },
    padding: '24px 32px 24px 32px',
    gap: '16px',
    alignItems: 'flex-start',
  },
  layout_ROW: {
    mode: 'row',
    dimensions: { width: 400, height: 40 },
    gap: '8px',
    justifyContent: 'space-between',
    // simplified 형식이 주는 부모 기준 상대 좌표 (픽셀 미리보기의 입력)
    locationRelativeToParent: { x: 32, y: 24 },
  },
  style_TITLE: { fontFamily: 'Inter', fontSize: 24, fontWeight: 700 },
  style_BTN: { fontFamily: 'Inter', fontSize: 14, fontWeight: 600 },
  fill_WHITE: ['#FFFFFF'],
  fill_INK: ['#111827'],
};

const MCP_NODE = {
  id: '15682:100905',
  name: 'Console_Setting_Group@User',
  type: 'FRAME',
  layout: 'layout_ROOT',
  fills: 'fill_WHITE',
  borderRadius: '12px',
  children: [
    {
      id: '15682:100906',
      name: 'Header',
      type: 'FRAME',
      layout: 'layout_ROW',
      children: [
        {
          id: '15682:100907',
          name: 'title',
          type: 'TEXT',
          text: 'Workspace/Group Settings',
          textStyle: 'style_TITLE',
          fills: 'fill_INK',
        },
        {
          id: '15682:100908',
          name: 'btn/save',
          type: 'TEXT',
          text: 'Save',
          textStyle: 'style_BTN',
          fills: 'fill_INK',
        },
      ],
    },
  ],
};

// Figma REST /v1/files 의 raw 형태
const REST_NODE = {
  id: '15682:100905',
  name: 'Console_Setting_Group@User',
  type: 'FRAME',
  absoluteBoundingBox: { x: 0, y: 0, width: 1440, height: 900 },
  layoutMode: 'VERTICAL',
  itemSpacing: 16,
  paddingTop: 24,
  paddingRight: 32,
  paddingBottom: 24,
  paddingLeft: 32,
  counterAxisAlignItems: 'MIN',
  cornerRadius: 12,
  fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }],
  children: [
    {
      id: '15682:100907',
      name: 'title',
      type: 'TEXT',
      characters: '  Workspace/Group Settings  ',
      style: { fontSize: 24, fontWeight: 700 },
      absoluteBoundingBox: { x: 32, y: 24, width: 300, height: 32 },
      fills: [{ type: 'SOLID', color: { r: 0.07, g: 0.09, b: 0.15, a: 1 } }],
    },
  ],
};

describe('normalizeMcpNode', () => {
  const view = normalizeMcpNode(MCP_NODE, MCP_STYLES);

  it('globalVars 참조를 해석해 레이아웃을 채운다', () => {
    expect(view.layoutMode).toBe('column');
    expect(view.width).toBe(1440);
    expect(view.height).toBe(900);
    expect(view.padding).toBe('24px 32px 24px 32px');
    expect(view.gap).toBe('16px');
    expect(view.alignItems).toBe('flex-start');
    expect(view.borderRadius).toBe('12px');
  });

  it('컨테이너 fill은 배경색, TEXT fill은 글자색으로 해석한다', () => {
    expect(view.backgroundColor).toBe('#FFFFFF');
    expect(view.textColor).toBeUndefined();

    const title = view.children![0].children![0];
    expect(title.type).toBe('TEXT');
    expect(title.textColor).toBe('#111827');
    expect(title.backgroundColor).toBeUndefined();
  });

  it('부모 기준 상대 좌표를 그대로 옮긴다 (Figma 픽셀 미리보기 입력)', () => {
    const header = view.children![0];
    expect(header.x).toBe(32);
    expect(header.y).toBe(24);
    // 좌표가 없는 노드는 undefined로 남아야 한다 (렌더러가 흐름 배치로 폴백한다)
    expect(view.x).toBeUndefined();
    expect(header.children![0].x).toBeUndefined();
  });

  it('텍스트 스타일과 트리 구조를 유지한다', () => {
    const header = view.children![0];
    expect(header.layoutMode).toBe('row');
    expect(header.justifyContent).toBe('space-between');

    const [title, save] = header.children!;
    expect(title.text).toBe('Workspace/Group Settings');
    expect(title.fontSize).toBe(24);
    expect(title.fontWeight).toBe(700);
    expect(save.text).toBe('Save');
    expect(save.fontSize).toBe(14);
  });
});

describe('normalizeRestNode', () => {
  const view = normalizeRestNode(REST_NODE);

  it('MCP 경로와 동일한 레이아웃 결과로 수렴한다', () => {
    expect(view.layoutMode).toBe('column');
    expect(view.width).toBe(1440);
    expect(view.height).toBe(900);
    expect(view.padding).toBe('24px 32px 24px 32px');
    expect(view.gap).toBe('16px');
    expect(view.alignItems).toBe('flex-start');
    expect(view.borderRadius).toBe('12px');
  });

  it('rgba 색상을 CSS 값으로 변환한다', () => {
    expect(view.backgroundColor).toBe('rgba(255, 255, 255, 1)');
  });

  it('characters의 앞뒤 공백을 정규화한다', () => {
    // Figma 텍스트에는 선행/후행 공백이 흔하다. 정규화하지 않으면 i18n 키 매핑이 실패한다.
    expect(view.children![0].text).toBe('Workspace/Group Settings');
  });

  it('절대 좌표를 부모 기준 상대 좌표로 변환한다 (MCP와 같은 기준)', () => {
    // REST는 absoluteBoundingBox(절대)만 준다. 부모 좌표를 빼야 left/top으로 쓸 수 있다.
    const title = view.children![0];
    expect(title.x).toBe(32); // 32 - 0
    expect(title.y).toBe(24); // 24 - 0
    // 루트는 기준이 될 부모가 없으므로 좌표를 갖지 않는다
    expect(view.x).toBeUndefined();
  });
});

describe('applyI18nKeys', () => {
  it('원문을 키로 역매핑하고 매핑률을 집계한다', () => {
    const view = normalizeMcpNode(MCP_NODE, MCP_STYLES);
    const textToKey = new Map([
      ['Workspace/Group Settings', 'console.setting.group.title.workspaceGroupSettings'],
      // 'Save'는 의도적으로 누락시켜 미매핑 집계를 확인한다
    ]);

    const stats = { textNodes: 0, mappedKeys: 0, totalNodes: 0 };
    applyI18nKeys(view, textToKey, stats);

    expect(stats.totalNodes).toBe(4);
    expect(stats.textNodes).toBe(2);
    expect(stats.mappedKeys).toBe(1);

    const [title, save] = view.children![0].children!;
    expect(title.i18nKey).toBe('console.setting.group.title.workspaceGroupSettings');
    // 미매핑 노드는 키가 없어야 한다. 조용히 원문으로 덮으면 누락을 발견할 수 없다.
    expect(save.i18nKey).toBeUndefined();
  });
});
