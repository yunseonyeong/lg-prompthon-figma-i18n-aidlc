/**
 * Figma MCP 클라이언트 (서버 사이드)
 *
 * 왜 서버에 두는가:
 *   figma-developer-mcp는 stdio 기반 JSON-RPC MCP 서버다. 브라우저는 자식 프로세스의
 *   stdin/stdout에 붙을 수 없으므로 MCP를 프론트엔드에서 직접 호출하는 것은 불가능하다.
 *   따라서 이 Express 서버가 MCP 클라이언트가 되어 /api/figma/* REST로 프록시한다.
 *
 * 데이터 출처 우선순위:
 *   1) MCP  (get_figma_data)      → source='mcp'
 *   2) Figma REST 직접 호출        → source='rest'   (MCP 프로세스 기동 실패 시)
 *   3) 디스크 캐시                 → source='cache'  (네트워크/429 실패 시)
 *
 * 원칙: 어떤 경로로 얻은 데이터인지 항상 응답에 실어 보낸다.
 *       화면이 "Figma에서 가져온 척"하는 것을 막기 위함이다.
 *       Figma /files API는 rate limit(429)이 엄격하므로 캐시가 기본 동작이고
 *       실시간 조회는 명시적 refresh 요청에서만 수행한다.
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const PROJECT_ROOT = path.join(__dirname, '..');
const STRUCTURE_CACHE_PATH = path.join(PROJECT_ROOT, 'src/figma-structure.json');
const COMPONENTS_MAP_PATH = path.join(PROJECT_ROOT, 'src/components-map.json');

// 프로젝트 .env 우선, 없는 값은 ~/.hermes/.env로 보완 (파이프라인과 동일한 규칙)
dotenv.config({ path: path.join(PROJECT_ROOT, '.env'), quiet: true });
dotenv.config({ path: path.join(os.homedir(), '.hermes', '.env'), quiet: true });

// ===== 공개 타입 =====

export type FigmaSource = 'mcp' | 'rest' | 'cache';

/** 렌더러가 소비하는 정규화된 노드. CSS 친화적 값으로 통일한다. */
export interface FigmaNodeView {
  id: string;
  name: string;
  type: string;
  /** TEXT 노드의 원문 */
  text?: string;
  /** components-map.json으로 역매핑한 i18n 키 */
  i18nKey?: string;
  layoutMode: 'none' | 'row' | 'column';
  width?: number;
  height?: number;
  /**
   * 부모 기준 상대 좌표(px). Figma 픽셀 그대로 미리보기를 그릴 때 쓴다.
   *
   * MCP는 layout.locationRelativeToParent로 이미 상대 좌표를 주고,
   * REST는 absoluteBoundingBox 절대 좌표라 부모 좌표를 빼서 맞춘다.
   */
  x?: number;
  y?: number;
  padding?: string;
  gap?: string;
  alignItems?: string;
  justifyContent?: string;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  fontWeight?: number;
  borderRadius?: string;
  borderColor?: string;
  opacity?: number;
  children?: FigmaNodeView[];
}

export interface FigmaStructurePayload {
  source: FigmaSource;
  fileKey: string;
  nodeId: string | null;
  fetchedAt: string;
  /** 최상위 프레임들 */
  frames: FigmaNodeView[];
  /** i18n 키가 매핑된 텍스트 노드 수 / 전체 텍스트 노드 수 */
  stats: { textNodes: number; mappedKeys: number; totalNodes: number };
  /** MCP/REST 실패 후 캐시로 폴백한 경우의 사유 */
  warning?: string;
}

export interface FigmaMcpStatus {
  /** MCP 프로세스에 연결되어 tools/list까지 성공했는지 */
  connected: boolean;
  /** MCP 서버가 노출한 도구 목록 */
  tools: string[];
  /** Figma 토큰 보유 여부 (값은 노출하지 않는다) */
  tokenPresent: boolean;
  transport: 'stdio';
  serverCommand: string;
  lastError: string | null;
  /** 마지막으로 성공한 데이터 출처 */
  lastSource: FigmaSource | null;
}

// ===== 내부 상태 =====

let mcpClient: any = null;
let mcpTools: string[] = [];
let mcpConnecting: Promise<any> | null = null;
let lastError: string | null = null;
let lastSource: FigmaSource | null = null;

function figmaToken(): string {
  return process.env.FIGMA_API_KEY || '';
}

function mcpCliPath(): string {
  // npx 대신 설치된 CLI를 직접 실행한다.
  // npx는 매 호출마다 레지스트리를 확인해 느리고, 오프라인에서 실패한다.
  return require.resolve('figma-developer-mcp/dist/cli.js');
}

/**
 * MCP 서버에 연결한다 (lazy, 1회만).
 * 실패해도 throw하지 않고 null을 반환한다 — 호출측이 REST로 폴백할 수 있도록.
 */
async function connectMcp(): Promise<any | null> {
  if (mcpClient) return mcpClient;
  if (mcpConnecting) return mcpConnecting;

  mcpConnecting = (async () => {
    try {
      const token = figmaToken();
      if (!token) throw new Error('FIGMA_API_KEY가 설정되지 않았습니다.');

      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
      const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');

      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [mcpCliPath(), '--stdio'],
        // OUTPUT_FORMAT=json: 기본값은 YAML이라 파싱 의존성이 늘어난다.
        env: { ...process.env, FIGMA_API_KEY: token, OUTPUT_FORMAT: 'json' } as Record<
          string,
          string
        >,
        stderr: 'pipe',
      });

      const client = new Client({ name: 'ux-dlc-server', version: '0.1.0' });
      await client.connect(transport);

      const listed = await client.listTools();
      mcpTools = listed.tools.map((t: any) => t.name);
      mcpClient = client;
      lastError = null;
      console.log(`   [Figma MCP] 연결 성공 — tools: ${mcpTools.join(', ')}`);
      return client;
    } catch (e: any) {
      lastError = `MCP 연결 실패: ${e?.message ?? String(e)}`;
      console.error(`   [Figma MCP] ${lastError}`);
      mcpClient = null;
      mcpTools = [];
      return null;
    } finally {
      mcpConnecting = null;
    }
  })();

  return mcpConnecting;
}

export async function getMcpStatus(): Promise<FigmaMcpStatus> {
  await connectMcp();
  return {
    connected: mcpClient !== null,
    tools: mcpTools,
    tokenPresent: figmaToken().length > 0,
    transport: 'stdio',
    serverCommand: 'figma-developer-mcp --stdio',
    lastError,
    lastSource,
  };
}

// ===== MCP 조회 =====

/**
 * MCP get_figma_data 호출.
 * MCP 서버는 Figma 오류(429 등)를 isError 응답으로 돌려주므로 그것도 예외로 승격시킨다.
 */
async function fetchViaMcp(
  fileKey: string,
  nodeId: string | null,
  depth: number | undefined
): Promise<{ frames: FigmaNodeView[] }> {
  const client = await connectMcp();
  if (!client) throw new Error(lastError ?? 'MCP 사용 불가');

  // depth를 넘기지 않으면 MCP가 전체 트리를 순회한다.
  const args: Record<string, unknown> = { fileKey };
  if (nodeId) args.nodeId = nodeId;
  if (depth !== undefined) args.depth = depth;

  const res: any = await client.callTool({ name: 'get_figma_data', arguments: args });
  const text: string = res?.content?.[0]?.text ?? '';

  if (res?.isError) {
    throw new Error(text || 'MCP get_figma_data 오류');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    // 툴이 에러 문자열을 평문으로 돌려주는 경우가 있다.
    throw new Error(`MCP 응답 파싱 실패: ${text.slice(0, 200)}`);
  }

  const globalStyles = parsed?.globalVars?.styles ?? {};
  const nodes: any[] = Array.isArray(parsed?.nodes) ? parsed.nodes : [];
  return { frames: nodes.map((n) => normalizeMcpNode(n, globalStyles)) };
}

/** globalVars.styles 참조 문자열을 실제 값으로 해석한다. */
function deref(value: unknown, styles: Record<string, unknown>): any {
  if (typeof value === 'string' && value in styles) return styles[value];
  return value;
}

/**
 * figma-developer-mcp의 simplified 노드 → FigmaNodeView
 *
 * simplified 형식은 layout/textStyle/fills를 globalVars 참조로 압축한다.
 * 값은 이미 CSS 친화적('8px', 'row')이라 대부분 그대로 쓴다.
 */
export function normalizeMcpNode(node: any, styles: Record<string, unknown>): FigmaNodeView {
  const layout = deref(node.layout, styles) ?? {};
  const textStyle = deref(node.textStyle, styles) ?? {};
  const fills = toArray(deref(node.fills, styles));
  const strokes = deref(node.strokes, styles) ?? {};

  const mode = layout.mode === 'row' || layout.mode === 'column' ? layout.mode : 'none';

  const view: FigmaNodeView = {
    id: String(node.id ?? ''),
    name: String(node.name ?? ''),
    type: String(node.type ?? 'FRAME'),
    layoutMode: mode,
  };

  if (typeof node.text === 'string' && node.text.trim()) view.text = node.text.trim();

  const dims = layout.dimensions ?? {};
  if (isNum(dims.width)) view.width = Math.round(dims.width);
  if (isNum(dims.height)) view.height = Math.round(dims.height);

  // simplified 형식은 부모 기준 상대 좌표를 그대로 준다
  const loc = layout.locationRelativeToParent;
  if (loc && isNum(loc.x) && isNum(loc.y)) {
    view.x = Math.round(loc.x);
    view.y = Math.round(loc.y);
  }

  if (typeof layout.padding === 'string') view.padding = layout.padding;
  if (typeof layout.gap === 'string') view.gap = layout.gap;
  if (typeof layout.alignItems === 'string') view.alignItems = cssAlign(layout.alignItems);
  if (typeof layout.justifyContent === 'string')
    view.justifyContent = cssAlign(layout.justifyContent);

  if (isNum(textStyle.fontSize)) view.fontSize = textStyle.fontSize;
  if (isNum(textStyle.fontWeight)) view.fontWeight = textStyle.fontWeight;

  // TEXT 노드의 fill은 글자색, 그 외에는 배경색으로 해석한다.
  const fillColor = firstColor(fills);
  if (fillColor) {
    if (view.type === 'TEXT') view.textColor = fillColor;
    else view.backgroundColor = fillColor;
  }

  const strokeColor = firstColor(toArray(strokes.colors ?? strokes));
  if (strokeColor) view.borderColor = strokeColor;

  if (typeof node.borderRadius === 'string') view.borderRadius = node.borderRadius;
  if (isNum(node.opacity)) view.opacity = node.opacity;

  if (Array.isArray(node.children) && node.children.length > 0) {
    view.children = node.children.map((c: any) => normalizeMcpNode(c, styles));
  }

  return view;
}

// ===== REST 폴백 =====

/**
 * Figma REST 직접 호출.
 * MCP 프로세스를 띄울 수 없는 환경(오프라인 npm, SDK 미설치)에서만 사용된다.
 */
async function fetchViaRest(
  fileKey: string,
  nodeId: string | null,
  depth: number | undefined
): Promise<{ frames: FigmaNodeView[] }> {
  const token = figmaToken();
  if (!token) throw new Error('FIGMA_API_KEY가 설정되지 않았습니다.');

  // depth 파라미터를 생략하면 Figma가 전체 트리를 반환한다.
  const depthParam = depth !== undefined ? `&depth=${depth}` : '';
  const url = nodeId
    ? `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}${depthParam}`
    : `https://api.figma.com/v1/files/${fileKey}${depthParam ? `?${depthParam.slice(1)}` : ''}`;

  const res = await fetch(url, { headers: { 'X-Figma-Token': token } });
  if (!res.ok) {
    throw new Error(`Figma REST ${res.status} ${res.statusText}`);
  }
  const data: any = await res.json();

  const roots: any[] = nodeId
    ? Object.values(data.nodes ?? {}).map((n: any) => n.document)
    : [data.document];

  return { frames: roots.filter(Boolean).map((n) => normalizeRestNode(n)) };
}

/**
 * Figma raw 노드 → FigmaNodeView
 *
 * parentBox는 상대 좌표 계산용이다. REST는 절대 좌표(absoluteBoundingBox)만 주므로
 * 부모 좌표를 빼서 MCP의 locationRelativeToParent와 같은 기준으로 맞춘다.
 */
export function normalizeRestNode(
  node: any,
  parentBox?: { x: number; y: number }
): FigmaNodeView {
  const view: FigmaNodeView = {
    id: String(node.id ?? ''),
    name: String(node.name ?? ''),
    type: String(node.type ?? 'FRAME'),
    layoutMode:
      node.layoutMode === 'HORIZONTAL' ? 'row' : node.layoutMode === 'VERTICAL' ? 'column' : 'none',
  };

  if (typeof node.characters === 'string' && node.characters.trim()) {
    view.text = node.characters.trim();
  }

  const box = node.absoluteBoundingBox;
  if (box) {
    if (isNum(box.width)) view.width = Math.round(box.width);
    if (isNum(box.height)) view.height = Math.round(box.height);
    if (parentBox && isNum(box.x) && isNum(box.y)) {
      view.x = Math.round(box.x - parentBox.x);
      view.y = Math.round(box.y - parentBox.y);
    }
  }

  const pt = node.paddingTop ?? 0;
  const pr = node.paddingRight ?? 0;
  const pb = node.paddingBottom ?? 0;
  const pl = node.paddingLeft ?? 0;
  if (pt || pr || pb || pl) view.padding = `${pt}px ${pr}px ${pb}px ${pl}px`;
  if (isNum(node.itemSpacing) && node.itemSpacing > 0) view.gap = `${node.itemSpacing}px`;
  if (node.counterAxisAlignItems) view.alignItems = cssAlign(node.counterAxisAlignItems);
  if (node.primaryAxisAlignItems) view.justifyContent = cssAlign(node.primaryAxisAlignItems);

  if (isNum(node.style?.fontSize)) view.fontSize = node.style.fontSize;
  if (isNum(node.style?.fontWeight)) view.fontWeight = node.style.fontWeight;

  const fillColor = firstColor(node.fills);
  if (fillColor) {
    if (view.type === 'TEXT') view.textColor = fillColor;
    else view.backgroundColor = fillColor;
  }
  const strokeColor = firstColor(node.strokes);
  if (strokeColor) view.borderColor = strokeColor;

  if (isNum(node.cornerRadius) && node.cornerRadius > 0) {
    view.borderRadius = `${node.cornerRadius}px`;
  }
  if (isNum(node.opacity) && node.opacity < 1) view.opacity = node.opacity;

  if (Array.isArray(node.children) && node.children.length > 0) {
    // 자식의 상대 좌표는 이 노드의 절대 좌표 기준이다
    const selfBox =
      box && isNum(box.x) && isNum(box.y) ? { x: box.x, y: box.y } : parentBox;
    view.children = node.children.map((c: any) => normalizeRestNode(c, selfBox));
  }

  return view;
}

// ===== i18n 키 매핑 =====

/**
 * components-map.json의 originalText → key 역인덱스를 만든다.
 * 파이프라인이 이미 만들어 둔 매핑을 재사용하므로 재번역 없이 화면에 키를 붙일 수 있다.
 */
async function loadTextToKeyMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const raw = await fs.readFile(COMPONENTS_MAP_PATH, 'utf-8');
    const frames = JSON.parse(raw);
    for (const frame of frames ?? []) {
      for (const child of frame.children ?? []) {
        if (child.originalText && child.key && !map.has(child.originalText)) {
          map.set(child.originalText, child.key);
        }
      }
    }
  } catch {
    // 매핑 파일이 없으면 원문만 렌더링한다.
  }
  return map;
}

export function applyI18nKeys(
  node: FigmaNodeView,
  textToKey: Map<string, string>,
  stats: { textNodes: number; mappedKeys: number; totalNodes: number }
): void {
  stats.totalNodes += 1;
  if (node.text) {
    stats.textNodes += 1;
    const key = textToKey.get(node.text);
    if (key) {
      node.i18nKey = key;
      stats.mappedKeys += 1;
    }
  }
  for (const child of node.children ?? []) applyI18nKeys(child, textToKey, stats);
}

// ===== 캐시 =====

async function readCache(): Promise<FigmaStructurePayload | null> {
  try {
    const raw = await fs.readFile(STRUCTURE_CACHE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    // 정규화된 payload 형식인지 확인 (구버전 파이프라인 산출물과 구분)
    if (parsed && Array.isArray(parsed.frames)) return parsed as FigmaStructurePayload;
    return null;
  } catch {
    return null;
  }
}

async function writeCache(payload: FigmaStructurePayload): Promise<void> {
  await fs.mkdir(path.dirname(STRUCTURE_CACHE_PATH), { recursive: true });
  await fs.writeFile(STRUCTURE_CACHE_PATH, JSON.stringify(payload, null, 2), 'utf-8');
}

// ===== 진입점 =====

export interface GetStructureOptions {
  fileKey: string;
  /** Figma 노드 ID. URL의 node-id 값. 쉼표 구분 시 첫 번째만 사용한다. */
  nodeId?: string | null;
  /**
   * 순회 깊이. 지정하지 않으면 전체 트리를 순회한다.
   *
   * 깊이를 제한하면 안 된다. 실측 결과 depth=8은 텍스트 노드 21개만 반환했고
   * 제한을 풀면 130개가 나온다 (Figma 컴포넌트 중첩이 20단계를 넘는다).
   * 파이프라인도 제한 없이 순회하므로 여기서 자르면 components-map과 어긋난다.
   */
  depth?: number;
  /** true면 캐시를 무시하고 MCP를 다시 호출한다. */
  refresh?: boolean;
}

/**
 * 프레임 구조를 가져온다.
 *
 * 기본은 캐시 우선이다. Figma /files API는 rate limit이 엄격해서(현재 토큰도 429 상태)
 * 화면 로드마다 실시간 호출하면 데모가 깨진다. 사용자가 명시적으로 새로고침할 때만 호출한다.
 */
export async function getFigmaStructure(
  opts: GetStructureOptions
): Promise<FigmaStructurePayload> {
  const { fileKey, refresh = false } = opts;
  const nodeId = opts.nodeId?.split(',')[0]?.trim() || null;
  // 기본값 없음 = 전체 순회. 위 GetStructureOptions.depth 주석 참고.
  const depth = opts.depth;

  if (!refresh) {
    const cached = await readCache();
    if (cached) {
      lastSource = 'cache';
      return { ...cached, source: 'cache' };
    }
  }

  const textToKey = await loadTextToKeyMap();
  const attempts: { source: FigmaSource; run: () => Promise<{ frames: FigmaNodeView[] }> }[] = [
    { source: 'mcp', run: () => fetchViaMcp(fileKey, nodeId, depth) },
    { source: 'rest', run: () => fetchViaRest(fileKey, nodeId, depth) },
  ];

  const errors: string[] = [];
  for (const attempt of attempts) {
    try {
      const { frames } = await attempt.run();
      if (frames.length === 0) throw new Error('프레임을 찾지 못했습니다 (fileKey/nodeId 확인)');

      const stats = { textNodes: 0, mappedKeys: 0, totalNodes: 0 };
      for (const f of frames) applyI18nKeys(f, textToKey, stats);

      const payload: FigmaStructurePayload = {
        source: attempt.source,
        fileKey,
        nodeId,
        fetchedAt: new Date().toISOString(),
        frames,
        stats,
      };
      await writeCache(payload);
      lastSource = attempt.source;
      lastError = null;
      return payload;
    } catch (e: any) {
      const msg = `${attempt.source}: ${e?.message ?? String(e)}`;
      errors.push(msg);
      console.error(`   [Figma MCP] ${msg}`);
    }
  }

  lastError = errors.join(' | ');

  // 마지막 수단: 캐시. 없으면 실패를 그대로 알린다 (가짜 데이터를 만들지 않는다).
  const cached = await readCache();
  if (cached) {
    lastSource = 'cache';
    return { ...cached, source: 'cache', warning: `실시간 조회 실패 → 캐시 사용 (${lastError})` };
  }

  throw new Error(lastError);
}

// ===== 유틸 =====

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function toArray(v: unknown): any[] {
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') return [v];
  return [];
}

/** Figma의 MIN/CENTER/MAX/SPACE_BETWEEN을 CSS flex 값으로 변환 */
function cssAlign(v: string): string {
  switch (v) {
    case 'MIN':
      return 'flex-start';
    case 'CENTER':
    case 'center':
      return 'center';
    case 'MAX':
      return 'flex-end';
    case 'SPACE_BETWEEN':
    case 'space-between':
      return 'space-between';
    default:
      return v;
  }
}

/**
 * fill 배열에서 첫 번째 유효한 색을 CSS 색으로 뽑는다.
 * simplified 형식은 이미 '#RRGGBB' 문자열이거나 {rgba:'...'} 형태이고,
 * raw 형식은 {color:{r,g,b,a}} 형태다. 둘 다 처리한다.
 */
function firstColor(fills: unknown): string | undefined {
  for (const fill of toArray(fills)) {
    if (typeof fill === 'string') {
      if (fill.startsWith('#') || fill.startsWith('rgb')) return fill;
      continue;
    }
    if (!fill || typeof fill !== 'object') continue;
    const f: any = fill;
    if (f.visible === false) continue;
    if (typeof f.rgba === 'string') return f.rgba;
    if (typeof f.hex === 'string') return f.hex;
    if (typeof f.color === 'string') return f.color;
    if (f.color && typeof f.color === 'object' && isNum(f.color.r)) {
      const { r, g, b } = f.color;
      const a = isNum(f.color.a) ? f.color.a : (f.opacity ?? 1);
      return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
    }
  }
  return undefined;
}
