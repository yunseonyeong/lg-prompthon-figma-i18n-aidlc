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

export interface ProjectConfig {
  figmaUrl: string;
  figmaFileKey: string;
  figmaFrameIds: string;
  domainDescription: string;
  targetLanguages: string[];
  lastUpdated?: string;
}

/** 서버에 저장된 프로젝트 설정 조회 */
export function fetchProjectConfig(): Promise<Partial<ProjectConfig>> {
  return getJson<Partial<ProjectConfig>>('/config');
}

/**
 * 프로젝트 설정을 서버에 저장한다.
 *
 * 이전에는 localStorage에만 저장해서 파이프라인(별도 프로세스)이 값을 볼 수 없었다.
 * 서버가 이 파일을 읽어 spawn 시 env로 전달한다.
 */
export async function saveProjectConfig(config: ProjectConfig): Promise<void> {
  const res = await fetch(`${API_BASE}/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
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

/** 다운로드 가능한 산출물 파일 (서버 allowlist와 일치해야 함) */
export const DOWNLOADABLE_FILES = [
  'en.json',
  'ko.json',
  'ja.json',
  'zh-CN.json',
  'components-map.json',
  'figma-structure.json',
] as const;

/** 산출물 파일 다운로드 URL (attachment 헤더로 내려옴) */
export function downloadUrl(name: string): string {
  return `${API_BASE}/pipeline/download/${encodeURIComponent(name)}`;
}

/** 실행별 번역 스냅샷 CSV 다운로드 URL */
export function translationsCsvUrl(runId: string): string {
  return `${API_BASE}/pipeline/history/${encodeURIComponent(runId)}/translations.csv`;
}

export interface TranslationRow {
  key: string;
  en: string;
  ko: string;
  ja: string;
  'zh-CN': string;
}

export interface TranslationSnapshot {
  runId: string;
  at: string;
  rowCount: number;
  rows: TranslationRow[];
}

/** 실행 시점 번역 결과(다국어 테이블) 조회 */
export function fetchTranslationSnapshot(runId: string): Promise<TranslationSnapshot> {
  return getJson<TranslationSnapshot>(`/pipeline/history/${encodeURIComponent(runId)}/translations`);
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
