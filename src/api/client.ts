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

/** POST /pipeline/extract 가 돌려주는 i18n 엔트리 (Step 1~3 결과) */
export interface ExtractedEntry {
  key: string;
  source: string;
  /** `${frameName} > ${role}` 형태 */
  context: string;
  role: string;
  translations: Record<string, string>;
  contextOnly: boolean;
}

export interface ExtractionResult {
  translationTargets: ExtractedEntry[];
  /** 추출된 원문에 실제로 등장한 용어집 항목만 */
  relevantGlossary: Record<string, Record<string, string>>;
}

/**
 * Step 1~3 실행: Figma 텍스트 추출 → 문맥 분석 → i18n Key 생성.
 *
 * components-map.json을 읽던 방식과 다른 점: 매 호출마다 Figma를 실제로 조회한다.
 * 따라서 파이프라인을 돌리지 않은 상태에서도 최신 디자인의 추출 결과를 볼 수 있고,
 * 디스크에 남은 옛 산출물을 보여주는 일이 없다. 대신 응답이 느리다(Figma API 왕복).
 *
 * fileKey를 생략하면 서버가 저장된 프로젝트 설정 → 환경변수 순으로 결정한다.
 */
export async function extractTexts(opts?: { fileKey?: string }): Promise<ExtractionResult> {
  return postPipeline<ExtractionResult>(
    '/pipeline/extract',
    opts?.fileKey ? { fileKey: opts.fileKey } : {}
  );
}

/** 용어집 맵: 영문 용어 → { ko, ja, 'zh-CN' }. extract 응답과 translate 요청이 같은 형태다 */
export type GlossaryPayload = Record<string, Record<string, string>>;

export interface TranslateResult {
  /** translations에 ko/ja/zh-CN이 채워진 엔트리 */
  translated: ExtractedEntry[];
  /** 언어별 중첩 리소스 (i18next addResourceBundle 형태) */
  locales: Record<string, Record<string, unknown>>;
  componentsMap: ComponentMapFrame[];
  glossaryProposal: string;
  summary: {
    translatedCount: number;
    localeLanguages: string[];
    componentsMapFrames: number;
  };
}

/**
 * Step 4~7 실행: EXAONE 번역 → locale JSON → components map → 용어집 제안.
 *
 * 요청 필드명은 extract 응답의 `translationTargets` / `relevantGlossary`를 그대로 쓴다.
 * 추출 → 확인 → 번역이 같은 이름의 같은 데이터를 주고받는다는 게 드러나야 한다.
 * 번역 금지로 표시된 용어는 relevantGlossary에서 제외해서 보낸다(호출부 책임).
 *
 * 용어집은 이 요청 값으로만 결정된다 — 서버가 용어집 파일을 다시 읽지 않는다.
 * 배치 번역이라 항목 수에 비례해 오래 걸린다 — 호출부에서 진행 상태를 보여줄 것.
 */
export async function translateEntries(req: {
  translationTargets: ExtractedEntry[];
  relevantGlossary: GlossaryPayload;
}): Promise<TranslateResult> {
  return postPipeline<TranslateResult>('/pipeline/translate', req);
}

/** EXAONE이 생성한 React 컴포넌트 1개 */
export interface GeneratedComponent {
  name: string;
  fileName: string;
  code: string;
  /** 원본 Figma 프레임 이름 */
  frame: string;
}

export interface GenerateComponentsResult {
  components: GeneratedComponent[];
  /** 프레임별 실패 이유 (일부만 실패했을 때) */
  failures: string[];
  summary: { generated: number; failed: number; frames: number };
}

/**
 * Step 8만 실행: Figma 구조 + i18n 키 매핑 → React 컴포넌트 코드 생성.
 *
 * 전체 파이프라인(/pipeline/run)과 달리 재추출·재번역을 하지 않는다.
 * 화면에서 확인한 번역 결과(componentsMap)를 그대로 넘기면 그 키로 코드를 만든다.
 * componentsMap을 생략하면 서버가 디스크의 components-map.json을 쓴다.
 *
 * 한 건도 만들지 못하면 502로 실패한다 — "생성 완료"로 위장하지 않는다.
 */
export function generateComponents(req?: {
  componentsMap?: ComponentMapFrame[];
  fileKey?: string;
}): Promise<GenerateComponentsResult> {
  return postPipeline<GenerateComponentsResult>('/pipeline/generate-components', req ?? {});
}

/** 파이프라인 API는 모두 `{ success, data, error }` 래퍼를 쓴다 */
async function postPipeline<T>(pathname: string, payload: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  let body: { success?: boolean; data?: T; error?: string } | null = null;
  try {
    body = await res.json();
  } catch {
    /* 본문이 JSON이 아니면 상태 코드만 사용 */
  }

  if (!res.ok || !body?.success || !body.data) {
    throw new Error(body?.error || `${res.status} ${res.statusText}`);
  }
  return body.data;
}

export function fetchLocale(lang: string): Promise<Record<string, unknown>> {
  return getJson<Record<string, unknown>>(`/pipeline/locales/${lang}`);
}

/** locale 실행 이력 1건 (src/data/locale-history/<runId>/) */
export interface LocaleHistoryRun {
  /** `20260821-110433` */
  runId: string;
  at: string | null;
  languages: string[];
  keyCount: number;
}

/**
 * locale 실행 이력 목록 (최신순).
 *
 * src/locales/*.json은 실행마다 갱신되므로, 과거 시점 번역은 이 이력으로만 볼 수 있다.
 */
export function fetchLocaleHistory(): Promise<{ runs: LocaleHistoryRun[] }> {
  return getJson<{ runs: LocaleHistoryRun[] }>('/pipeline/locale-history');
}

/** 특정 실행 시점의 locale JSON */
export function fetchLocaleHistoryEntry(
  runId: string,
  lang: string
): Promise<Record<string, unknown>> {
  return getJson<Record<string, unknown>>(
    `/pipeline/locale-history/${encodeURIComponent(runId)}/${encodeURIComponent(lang)}`
  );
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

// 실행 요약 기록(pipeline-history)과 그에 딸린 번역 스냅샷/CSV API는 제거했다.
// 실행 이력은 locale 사본(fetchLocaleHistory) 하나만 쓴다 — 기록이 두 곳으로
// 갈라져 있으면 한쪽만 적재되는 일이 생긴다(실제로 그랬다).

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
