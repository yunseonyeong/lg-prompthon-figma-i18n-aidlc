/**
 * Figma / 파이프라인 데이터 로딩 훅
 *
 * 모두 런타임 fetch다. static import를 쓰지 않는 이유는
 * 파이프라인 재실행 결과가 재빌드 없이 화면에 반영되어야 하기 때문이다.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  fetchComponentsMap,
  fetchFigmaMcpStatus,
  fetchFigmaStructure,
} from '../api/client';
import type {
  ComponentMapFrame,
  FigmaMcpStatus,
  FigmaStructurePayload,
} from '../types/figma';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/** Figma MCP 연결 상태. UI가 "연동됨"을 사실에 근거해 표시하기 위해 쓴다. */
export function useFigmaMcpStatus() {
  const [state, setState] = useState<AsyncState<FigmaMcpStatus>>({
    data: null,
    loading: true,
    error: null,
  });

  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const data = await fetchFigmaMcpStatus();
      setState({ data, loading: false, error: null });
    } catch (e: any) {
      setState({ data: null, loading: false, error: e?.message ?? String(e) });
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload };
}

/**
 * Figma 프레임 구조.
 * refresh()를 호출할 때만 MCP로 실시간 조회한다 (Figma API rate limit 보호).
 */
export function useFigmaStructure(opts?: { fileKey?: string; nodeId?: string }) {
  const [state, setState] = useState<AsyncState<FigmaStructurePayload>>({
    data: null,
    loading: true,
    error: null,
  });

  const fileKey = opts?.fileKey;
  const nodeId = opts?.nodeId;

  const load = useCallback(
    async (refresh: boolean) => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const data = await fetchFigmaStructure({ fileKey, nodeId, refresh });
        setState({ data, loading: false, error: null });
      } catch (e: any) {
        setState({ data: null, loading: false, error: e?.message ?? String(e) });
      }
    },
    [fileKey, nodeId]
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  return {
    ...state,
    /** 캐시 무시하고 MCP 재조회 */
    refresh: () => load(true),
  };
}

/** 파이프라인이 만든 i18n 키 매핑 */
export function useComponentsMap() {
  const [state, setState] = useState<AsyncState<ComponentMapFrame[]>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchComponentsMap();
        if (!cancelled) setState({ data, loading: false, error: null });
      } catch (e: any) {
        if (!cancelled) setState({ data: null, loading: false, error: e?.message ?? String(e) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

// locale 로딩은 여기 있던 useLiveLocales()에서 src/i18n.ts의 loadLocalesFromApi()로 옮겼다.
// 3개 Step이 각자 훅을 호출해 4개 locale을 중복 fetch하고 있었고(총 12회),
// 무엇보다 i18n.ts가 static import를 유지하는 한 "번들 값 → 런타임 덮어쓰기" 순서가
// 항상 한 박자 늦어 초기 렌더에 옛 번역이 노출됐다.
// 이제 App이 진입 시 1회 로드하고 i18n.ts는 빈 리소스로 시작한다.
