/**
 * EXAONE 번역 실행(POST /api/pipeline/translate) 상태 저장소.
 *
 * ## 왜 스토어가 필요한가
 * 실행을 시작하는 화면(Step 3 용어집)과 결과를 보는 화면(Step 4 번역 리뷰)이 다르다.
 * 컴포넌트 지역 상태에 두면 Step 이동으로 언마운트될 때 진행 중인 실행이 사라진다.
 * 또 번역은 배치 호출이라 수십 초~수 분 걸리므로, 사용자가 화면을 옮겨도
 * 실행이 계속되고 완료 결과를 볼 수 있어야 한다.
 *
 * 요청은 사용자가 "EXAONE 번역 시작"을 눌렀을 때 단 한 번 발생한다.
 * (이전 용어집 화면은 번역 여부 토글마다 서버를 호출했다 — 그 호출을 없앤 자리다.)
 */

import { useSyncExternalStore } from 'react';
import {
  translateEntries,
  type ExtractedEntry,
  type GlossaryPayload,
  type TranslateResult,
} from '../api/client';
import i18n from '../i18n';

/** 필드명은 extract 응답을 그대로 유지한다 (translationTargets / relevantGlossary) */
export interface TranslationRunRequest {
  translationTargets: ExtractedEntry[];
  /** 번역 금지 용어를 제외한 용어집 */
  relevantGlossary: GlossaryPayload;
}

export interface TranslationRunState {
  status: 'idle' | 'running' | 'done' | 'error';
  data: TranslateResult | null;
  error: string | null;
  /** 실행 시작 시각(ms). 경과 시간 표시용 */
  startedAt: number | null;
  finishedAt: number | null;
  /** 재시도와 화면 표시를 위해 마지막 요청을 보관 */
  request: TranslationRunRequest | null;
}

const initialState: TranslationRunState = {
  status: 'idle',
  data: null,
  error: null,
  startedAt: null,
  finishedAt: null,
  request: null,
};

let state: TranslationRunState = initialState;
let inFlight: Promise<TranslateResult> | null = null;
const listeners = new Set<() => void>();

function setState(patch: Partial<TranslationRunState>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): TranslationRunState {
  return state;
}

/**
 * 번역 실행. 이미 진행 중이면 그 실행을 그대로 이어 쓴다(중복 호출 방지).
 * 실패는 상태로 흘리고 throw하지 않는다 — 호출부가 화면 이동을 계속할 수 있어야 한다.
 */
export function startTranslationRun(request: TranslationRunRequest): Promise<TranslateResult | null> {
  if (inFlight) return inFlight.catch(() => null);

  setState({
    status: 'running',
    data: null,
    error: null,
    startedAt: Date.now(),
    finishedAt: null,
    request,
  });

  inFlight = translateEntries(request);

  return inFlight
    .then((data) => {
      // 서버가 locale 파일을 썼지만 i18next는 App 진입 시 로드한 값을 들고 있다.
      // 응답에 담긴 리소스를 그대로 주입해 미리보기(Step 6)까지 최신 번역이 반영되게 한다.
      for (const [lang, resources] of Object.entries(data.locales)) {
        i18n.addResourceBundle(lang, 'translation', resources, true, true);
      }
      void i18n.changeLanguage(i18n.language);

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

/** 마지막 요청으로 재실행 (실패 후 재시도용) */
export function retryTranslationRun(): Promise<TranslateResult | null> {
  if (!state.request) return Promise.resolve(null);
  return startTranslationRun(state.request);
}

export function resetTranslationRun(): void {
  if (inFlight) return; // 진행 중인 실행은 건드리지 않는다
  state = initialState;
  listeners.forEach((l) => l());
}

export function useTranslationRun(): TranslationRunState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
