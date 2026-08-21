/**
 * Figma / 파이프라인 데이터 로딩 훅
 *
 * 모두 런타임 fetch다. static import를 쓰지 않는 이유는
 * 파이프라인 재실행 결과가 재빌드 없이 화면에 반영되어야 하기 때문이다.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  extractTexts,
  fetchComponentsMap,
  fetchFigmaMcpStatus,
  fetchFigmaStructure,
  fetchProjectConfig,
  type ExtractionResult,
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

/**
 * 모듈 스코프 캐시.
 *
 * 추출은 Figma API 왕복이라 수 초가 걸린다. Step 인디케이터로 2단계를 여러 번
 * 드나들 때마다 재조회하면 대기 시간이 반복되고 Figma rate limit도 갉아먹는다.
 * 명시적으로 refresh()를 호출할 때만 다시 부른다.
 */
let extractionCache: ExtractionResult | null = null;

/**
 * Step 1~3(추출 → 문맥 분석 → 키 생성)을 서버에서 실행한 결과.
 *
 * 이전에는 이 자리에서 useComponentsMap()으로 파이프라인 산출물 파일을 읽었다.
 * 그건 "지난 실행 결과"이지 "지금 Figma의 추출 결과"가 아니어서,
 * 파이프라인을 돌리지 않으면 화면이 비거나 옛 데이터가 보였다.
 * 이제 POST /api/pipeline/extract를 호출해 실제 추출을 수행한다.
 */
export function useExtraction() {
  const [state, setState] = useState<AsyncState<ExtractionResult>>({
    data: extractionCache,
    loading: extractionCache === null,
    error: null,
  });

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (force: boolean) => {
    if (!force && extractionCache) {
      setState({ data: extractionCache, loading: false, error: null });
      return;
    }
    // 재추출 중에도 기존 표를 유지한다 (화면이 비어 보이는 깜빡임 방지)
    setState((s) => ({ data: force ? s.data : null, loading: true, error: null }));
    try {
      // 화면에서 저장한 File Key를 우선 사용한다. 설정 조회가 실패해도 추출은 진행한다
      // (서버가 프로젝트 설정 → 환경변수 순으로 폴백).
      const config = await fetchProjectConfig().catch(() => ({} as { figmaFileKey?: string }));
      const data = await extractTexts({ fileKey: config.figmaFileKey });
      extractionCache = data;
      if (mounted.current) setState({ data, loading: false, error: null });
    } catch (e: any) {
      if (mounted.current) {
        setState({ data: null, loading: false, error: e?.message ?? String(e) });
      }
    }
  }, []);

  useEffect(() => {
    void run(false);
  }, [run]);

  return {
    ...state,
    /** 캐시 무시하고 Figma에서 다시 추출 */
    refresh: () => run(true),
  };
}

// locale 로딩은 여기 있던 useLiveLocales()에서 src/i18n.ts의 loadLocalesFromApi()로 옮겼다.
// 3개 Step이 각자 훅을 호출해 4개 locale을 중복 fetch하고 있었고(총 12회),
// 무엇보다 i18n.ts가 static import를 유지하는 한 "번들 값 → 런타임 덮어쓰기" 순서가
// 항상 한 박자 늦어 초기 렌더에 옛 번역이 노출됐다.
// 이제 App이 진입 시 1회 로드하고 i18n.ts는 빈 리소스로 시작한다.
