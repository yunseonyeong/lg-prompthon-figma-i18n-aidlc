/**
 * 컴포넌트 코드 생성(POST /api/pipeline/generate-components) 상태 저장소.
 *
 * translationRun.ts와 같은 이유로 스토어가 필요하다: 실행을 시작하는 화면(Step 4의
 * "코드 생성")과 결과를 보는 화면(Step 5)이 다르고, EXAONE 호출이 프레임당 10초 이상
 * 걸리므로 Step을 옮겨도 실행이 살아 있어야 한다.
 */

import { useSyncExternalStore } from 'react';
import { generateComponents, type GenerateComponentsResult } from '../api/client';
import type { ComponentMapFrame } from '../types/figma';

export interface ComponentRunRequest {
  /** 번역 결과의 componentsMap. 없으면 서버가 디스크 산출물을 쓴다 */
  componentsMap?: ComponentMapFrame[];
}

export interface ComponentRunState {
  status: 'idle' | 'running' | 'done' | 'error';
  data: GenerateComponentsResult | null;
  error: string | null;
  startedAt: number | null;
  finishedAt: number | null;
  request: ComponentRunRequest | null;
}

const initialState: ComponentRunState = {
  status: 'idle',
  data: null,
  error: null,
  startedAt: null,
  finishedAt: null,
  request: null,
};

let state: ComponentRunState = initialState;
let inFlight: Promise<GenerateComponentsResult> | null = null;
const listeners = new Set<() => void>();

function setState(patch: Partial<ComponentRunState>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): ComponentRunState {
  return state;
}

/**
 * 컴포넌트 생성 실행. 이미 진행 중이면 그 실행을 이어 쓴다.
 * 실패는 상태로 흘리고 throw하지 않는다 (호출부가 화면 이동을 계속할 수 있어야 한다).
 */
export function startComponentRun(
  request: ComponentRunRequest = {}
): Promise<GenerateComponentsResult | null> {
  if (inFlight) return inFlight.catch(() => null);

  setState({
    status: 'running',
    data: null,
    error: null,
    startedAt: Date.now(),
    finishedAt: null,
    request,
  });

  inFlight = generateComponents(request);

  return inFlight
    .then((data) => {
      setState({ status: 'done', data, error: null, finishedAt: Date.now() });
      return data;
    })
    .catch((e: unknown) => {
      setState({
        status: 'error',
        data: null,
        error: e instanceof Error ? e.message : String(e),
        finishedAt: Date.now(),
      });
      return null;
    })
    .finally(() => {
      inFlight = null;
    });
}

/** 마지막 요청으로 재실행 */
export function retryComponentRun(): Promise<GenerateComponentsResult | null> {
  return startComponentRun(state.request ?? {});
}

export function useComponentRun(): ComponentRunState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
