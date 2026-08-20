/**
 * StepCompare — 완료 버튼 회귀 테스트
 *
 * 기존 결함: 마지막 단계의 "✅ 완료" 버튼에 disabled가 하드코딩되어 있고
 *            onClick 핸들러도 없어 클릭이 아예 불가능했다.
 *            App도 완료를 받을 콜백을 넘기지 않았다.
 */

// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import i18next from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import StepCompare from './StepCompare';

const COMPONENTS_MAP = [
  {
    frame: 'Console_Setting_Group@User',
    frameId: '15682-10150',
    children: [
      {
        type: 'title',
        key: 'console.setting.group.title.workspaceGroupSettings',
        originalText: 'Workspace/Group Settings',
      },
      {
        type: 'button',
        key: 'console.setting.group.button.save',
        originalText: 'Save',
      },
    ],
  },
];

beforeAll(async () => {
  await i18next.use(initReactI18next).init({
    resources: {
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
    },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
});

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(COMPONENTS_MAP), { status: 200 }))
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderStep(onComplete = vi.fn(), onBack = vi.fn()) {
  render(
    <I18nextProvider i18n={i18next}>
      <StepCompare onBack={onBack} onComplete={onComplete} />
    </I18nextProvider>
  );
  return { onComplete, onBack };
}

describe('StepCompare 완료 버튼', () => {
  it('데이터 로드 후 완료 버튼이 활성 상태로 렌더된다', async () => {
    renderStep();

    const button = await waitFor(() => screen.getByRole('button', { name: /완료/ }));
    expect(button).toBeTruthy();
    // 회귀 방지: disabled가 다시 박히면 여기서 실패한다.
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it('완료 버튼 클릭 시 onComplete가 호출된다', async () => {
    const { onComplete } = renderStep();

    const button = await waitFor(() => screen.getByRole('button', { name: /완료/ }));
    await act(async () => {
      button.click();
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('이전 버튼은 onBack을 호출한다', async () => {
    const { onBack } = renderStep();

    // 로딩 분기에도 "← 이전"이 있다. 그 노드를 잡으면 로드 완료 시 DOM에서
    // 분리되어 클릭이 핸들러에 닿지 않는다. 완료 버튼 등장으로 로드 완료를 확인한 뒤 조회한다.
    await waitFor(() => screen.getByRole('button', { name: /완료/ }));

    const button = screen.getByRole('button', { name: /이전/ });
    await act(async () => {
      button.click();
    });

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
