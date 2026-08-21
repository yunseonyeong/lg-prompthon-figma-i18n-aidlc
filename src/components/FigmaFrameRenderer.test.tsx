/**
 * FigmaFrameRenderer 렌더 테스트
 *
 * 검증 대상은 이 프로젝트의 핵심 주장이다:
 *   "화면은 Figma에서 온 레이아웃이고, 텍스트만 i18n 키로 치환된다"
 *
 * 따라서 확인할 것은 두 가지다.
 *   1) Figma 구조의 레이아웃/스타일이 DOM에 반영되는가
 *   2) 언어를 바꾸면 같은 레이아웃 위에서 텍스트만 바뀌는가
 */

// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import i18next from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { initReactI18next } from 'react-i18next';
import FigmaFrameRenderer from './FigmaFrameRenderer';
import type { FigmaNodeView } from '../types/figma';

// 서버가 MCP로 조회해 정규화한 구조와 동일한 형태
const FRAME: FigmaNodeView = {
  id: '15682:100905',
  name: 'Console_Setting_Group@User',
  type: 'FRAME',
  layoutMode: 'column',
  width: 1440,
  height: 900,
  padding: '24px 32px 24px 32px',
  gap: '16px',
  backgroundColor: '#FFFFFF',
  borderRadius: '12px',
  children: [
    {
      id: '15682:100906',
      name: 'Header',
      type: 'FRAME',
      layoutMode: 'row',
      gap: '8px',
      justifyContent: 'space-between',
      children: [
        {
          id: '15682:100907',
          name: 'title',
          type: 'TEXT',
          layoutMode: 'none',
          text: 'Workspace/Group Settings',
          i18nKey: 'console.setting.group.title.workspaceGroupSettings',
          fontSize: 24,
          fontWeight: 700,
          textColor: '#111827',
        },
        {
          id: '15682:100908',
          name: 'btn/save',
          type: 'TEXT',
          layoutMode: 'none',
          text: 'Save',
          i18nKey: 'console.setting.group.button.save',
          fontSize: 14,
        },
        {
          // 파이프라인이 번역 대상에서 제외한 텍스트 (시나리오 설명 테이블 헤더)
          id: '15682:100909',
          name: 'Description',
          type: 'TEXT',
          layoutMode: 'none',
          text: 'Classification',
        },
      ],
    },
  ],
};

const RESOURCES = {
  en: {
    translation: {
      console: {
        setting: {
          group: {
            title: { workspaceGroupSettings: 'Workspace/Group Settings' },
            button: { save: 'Save' },
          },
        },
      },
    },
  },
  ko: {
    translation: {
      console: {
        setting: {
          group: {
            title: { workspaceGroupSettings: '워크스페이스/그룹 설정' },
            button: { save: '저장' },
          },
        },
      },
    },
  },
};

beforeAll(async () => {
  await i18next.use(initReactI18next).init({
    resources: RESOURCES,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
});

afterEach(async () => {
  // vitest globals를 쓰지 않으므로 RTL 자동 cleanup이 등록되지 않는다. 직접 정리한다.
  cleanup();
  await i18next.changeLanguage('en');
});

function renderFrame() {
  return render(
    <I18nextProvider i18n={i18next}>
      <FigmaFrameRenderer node={FRAME} />
    </I18nextProvider>
  );
}

/** i18next 언어 변경은 React 외부 이벤트라 act로 감싸야 리렌더가 flush된다. */
async function switchLanguage(lang: string) {
  await act(async () => {
    await i18next.changeLanguage(lang);
  });
}

describe('FigmaFrameRenderer', () => {
  it('Figma 레이아웃을 DOM 스타일로 반영한다', () => {
    const { container } = renderFrame();

    const root = container.querySelector('[data-figma-id="15682:100905"]') as HTMLElement;
    expect(root).toBeTruthy();
    expect(root.style.display).toBe('flex');
    expect(root.style.flexDirection).toBe('column');
    expect(root.style.gap).toBe('16px');
    expect(root.style.width).toBe('1440px');
    expect(root.style.borderRadius).toBe('12px');

    const header = container.querySelector('[data-figma-id="15682:100906"]') as HTMLElement;
    expect(header.style.flexDirection).toBe('row');
    expect(header.style.justifyContent).toBe('space-between');
  });

  it('TEXT 노드에 Figma 타이포그래피를 적용한다', () => {
    const { container } = renderFrame();
    const title = container.querySelector('[data-figma-id="15682:100907"]') as HTMLElement;
    expect(title.style.fontSize).toBe('24px');
    expect(title.style.fontWeight).toBe('700');
    expect(title.style.color).toBe('rgb(17, 24, 39)');
  });

  it('TEXT 노드에는 flex 레이아웃을 적용하지 않는다', () => {
    const { container } = renderFrame();
    // display:flex; flex-direction:column이 붙으면 텍스트가 글자 단위로 깨진다.
    for (const id of ['15682:100907', '15682:100908', '15682:100909']) {
      const el = container.querySelector(`[data-figma-id="${id}"]`) as HTMLElement;
      expect(el.style.display).toBe('');
      expect(el.style.flexDirection).toBe('');
    }
  });

  it('i18n 키가 있는 텍스트는 언어 전환 시 값이 바뀐다', async () => {
    renderFrame();

    expect(screen.getByText('Workspace/Group Settings')).toBeTruthy();
    expect(screen.getByText('Save')).toBeTruthy();

    await switchLanguage('ko');

    expect(screen.getByText('워크스페이스/그룹 설정')).toBeTruthy();
    expect(screen.getByText('저장')).toBeTruthy();
    expect(screen.queryByText('Workspace/Group Settings')).toBeNull();
  });

  it('i18n 키가 없는 텍스트는 언어와 무관하게 Figma 원문을 유지한다', async () => {
    renderFrame();

    // 번역 제외 대상은 키가 없으므로 원문이 그대로 남아야 한다.
    expect(screen.getByText('Classification')).toBeTruthy();

    await switchLanguage('ko');
    expect(screen.getByText('Classification')).toBeTruthy();
  });

  it('레이아웃 컨테이너에 고정 높이를 주지 않아 번역으로 길어진 텍스트를 잘라내지 않는다', () => {
    const { container } = renderFrame();
    const header = container.querySelector('[data-figma-id="15682:100906"]') as HTMLElement;
    // 자식 컨테이너에 height가 박히면 ko/ja 번역이 넘칠 때 잘린다.
    expect(header.style.height).toBe('');
    const title = container.querySelector('[data-figma-id="15682:100907"]') as HTMLElement;
    expect(title.style.height).toBe('');
  });
});

/**
 * Figma 좌표(x/y)가 있는 구조. 서버가 MCP locationRelativeToParent /
 * REST absoluteBoundingBox 차이로 채워 보내는 값이다.
 */
const POSITIONED_FRAME: FigmaNodeView = {
  id: 'root',
  name: 'Screen',
  type: 'FRAME',
  layoutMode: 'column',
  width: 1440,
  height: 900,
  gap: '16px',
  children: [
    {
      id: 'card',
      name: 'Card',
      type: 'FRAME',
      layoutMode: 'none',
      x: 32,
      y: 64,
      width: 400,
      height: 200,
      backgroundColor: '#FFFFFF',
      children: [
        {
          id: 'title',
          name: 'title',
          type: 'TEXT',
          layoutMode: 'none',
          x: 16,
          y: 12,
          width: 300,
          height: 32,
          text: 'Workspace/Group Settings',
          i18nKey: 'console.setting.group.title.workspaceGroupSettings',
          fontSize: 24,
        },
      ],
    },
    {
      // 좌표가 없는 노드 — 픽셀 모드에서도 흐름 배치로 폴백해야 한다
      id: 'floating',
      name: 'NoCoords',
      type: 'FRAME',
      layoutMode: 'row',
      backgroundColor: '#EEEEEE',
      children: [
        { id: 'plain', name: 'plain', type: 'TEXT', layoutMode: 'none', text: 'Classification' },
      ],
    },
  ],
};

function renderPositioned(mode: 'pixel' | 'flow' = 'pixel') {
  return render(
    <I18nextProvider i18n={i18next}>
      <FigmaFrameRenderer node={POSITIONED_FRAME} mode={mode} />
    </I18nextProvider>
  );
}

describe('FigmaFrameRenderer — Figma 픽셀 배치', () => {
  it('좌표가 있는 노드를 Figma px 그대로 absolute 배치한다', () => {
    const { container } = renderPositioned();

    const card = container.querySelector('[data-figma-id="card"]') as HTMLElement;
    expect(card.style.position).toBe('absolute');
    expect(card.style.left).toBe('32px');
    expect(card.style.top).toBe('64px');
    expect(card.style.width).toBe('400px');
    expect(card.style.height).toBe('200px');

    // 자식 좌표는 부모(card) 기준이다
    const title = container.querySelector('[data-figma-id="title"]') as HTMLElement;
    expect(title.style.left).toBe('16px');
    expect(title.style.top).toBe('12px');
  });

  it('absolute 자식을 두는 컨테이너는 위치 기준(relative)이 된다', () => {
    const { container } = renderPositioned();
    const root = container.querySelector('[data-figma-id="root"]') as HTMLElement;
    const card = container.querySelector('[data-figma-id="card"]') as HTMLElement;
    expect(root.style.position).toBe('relative');
    expect(card.style.position).toBe('absolute');
    // 자식을 절대 배치하는 컨테이너에 flex/gap을 남기면 gap이 무의미하게 붙는다
    expect(root.style.display).toBe('');
    expect(root.style.gap).toBe('');
  });

  it('TEXT는 height를 고정하지 않아 번역이 길어져도 잘리지 않는다', () => {
    const { container } = renderPositioned();
    const title = container.querySelector('[data-figma-id="title"]') as HTMLElement;
    expect(title.style.height).toBe('');
    expect(title.style.minHeight).toBe('32px');
    expect(title.style.width).toBe('300px');
  });

  it('좌표가 없는 노드는 픽셀 모드에서도 흐름 배치로 폴백한다', () => {
    const { container } = renderPositioned();
    const floating = container.querySelector('[data-figma-id="floating"]') as HTMLElement;
    expect(floating.style.position).toBe('');
    expect(floating.style.left).toBe('');
    // Auto Layout 정보는 그대로 살아 있다
    expect(floating.style.display).toBe('flex');
    expect(floating.style.flexDirection).toBe('row');
  });

  it('flow 모드에서는 좌표를 무시하고 Auto Layout으로 배치한다', () => {
    const { container } = renderPositioned('flow');
    const root = container.querySelector('[data-figma-id="root"]') as HTMLElement;
    const card = container.querySelector('[data-figma-id="card"]') as HTMLElement;
    expect(root.style.display).toBe('flex');
    expect(root.style.gap).toBe('16px');
    expect(card.style.position).toBe('');
    expect(card.style.left).toBe('');
  });
});
