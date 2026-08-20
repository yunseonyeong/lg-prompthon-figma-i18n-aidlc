/**
 * UX DLC API 클라이언트
 *
 * 파이프라인 산출물(components-map, locales)과 Figma MCP 조회를 모두 서버 API로 통일한다.
 * 이전에는 components-map.json을 static import했는데, 그러면 파이프라인을 재실행해도
 * 번들이 다시 빌드되기 전까지 화면이 옛 데이터를 보여준다. 런타임 fetch로 바꾼 이유.
 */

import type {
  ComponentMapFrame,
  FigmaMcpStatus,
  FigmaStructurePayload,
} from '../types/figma';

export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api';

async function getJson<T>(pathname: string): Promise<T> {
  const res = await fetch(`${API_BASE}${pathname}`);
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      detail = body.detail || body.error || detail;
    } catch {
      /* 본문이 JSON이 아니면 상태 코드만 사용 */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export function fetchFigmaMcpStatus(): Promise<FigmaMcpStatus> {
  return getJson<FigmaMcpStatus>('/figma/status');
}

export function fetchFigmaStructure(opts?: {
  fileKey?: string;
  nodeId?: string;
  refresh?: boolean;
}): Promise<FigmaStructurePayload> {
  const params = new URLSearchParams();
  if (opts?.fileKey) params.set('fileKey', opts.fileKey);
  if (opts?.nodeId) params.set('nodeId', opts.nodeId);
  if (opts?.refresh) params.set('refresh', 'true');
  const qs = params.toString();
  return getJson<FigmaStructurePayload>(`/figma/structure${qs ? `?${qs}` : ''}`);
}

export function fetchComponentsMap(): Promise<ComponentMapFrame[]> {
  return getJson<ComponentMapFrame[]>('/pipeline/components-map');
}

export function fetchLocale(lang: string): Promise<Record<string, unknown>> {
  return getJson<Record<string, unknown>>(`/pipeline/locales/${lang}`);
}

/** 번역 1건 수정 후 locale JSON에 저장 */
export async function updateLocaleEntry(
  lang: string,
  key: string,
  value: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/pipeline/locales/${lang}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
  });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      detail = body.detail || body.error || detail;
    } catch {
      /* 본문이 JSON이 아니면 상태 코드만 사용 */
    }
    throw new Error(detail);
  }
}
