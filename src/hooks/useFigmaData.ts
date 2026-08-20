/**
 * Figma / 파이프라인 데이터 로딩 훅
 *
 * 모두 런타임 fetch다. static import를 쓰지 않는 이유는
 * 파이프라인 재실행 결과가 재빌드 없이 화면에 반영되어야 하기 때문이다.
 */

import { useCallback, useEffect, useState } from 'react';
import i18n from '../i18n';
import {
  fetchComponentsMap,
  fetchFigmaMcpStatus,
  fetchFigmaStructure,
  fetchLocale,
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

const LANGUAGES = ['en', 'ko', 'ja', 'zh-CN'];

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

/**
 * 파이프라인이 방금 쓴 locale JSON을 i18next에 주입한다.
 *
 * i18n.ts는 locale을 static import하므로 번들 시점 값이 고정된다.
 * 파이프라인을 재실행한 직후에도 최신 번역이 화면에 보이도록 런타임에 덮어쓴다.
 */
export function useLiveLocales() {
  const [synced, setSynced] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results = await Promise.allSettled(
        LANGUAGES.map(async (lang) => {
          const resources = await fetchLocale(lang);
          return { lang, resources };
        })
      );
      if (cancelled) return;

      let applied = 0;
      for (const r of results) {
        if (r.status === 'fulfilled') {
          // deep=true, overwrite=true: 파이프라인 산출물이 항상 우선
          i18n.addResourceBundle(r.value.lang, 'translation', r.value.resources, true, true);
          applied += 1;
        }
      }
      if (applied === 0) {
        setError('API에서 locale을 불러오지 못했습니다. 번들에 포함된 번역을 사용합니다.');
      } else {
        // 이미 렌더된 트리에 새 리소스를 반영
        void i18n.changeLanguage(i18n.language);
      }
      setSynced(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { synced, error };
}
