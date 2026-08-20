/**
 * Figma 구조 타입 (server/figma-mcp.ts와 동일한 형태)
 *
 * 서버가 MCP simplified / REST raw 두 형식을 이 타입으로 정규화해서 내려주므로
 * 프론트엔드는 출처를 신경 쓰지 않고 렌더링만 한다.
 */

export type FigmaSource = 'mcp' | 'rest' | 'cache';

export interface FigmaNodeView {
  id: string;
  name: string;
  type: string;
  /** TEXT 노드의 Figma 원문 */
  text?: string;
  /** components-map.json으로 역매핑된 i18n 키 */
  i18nKey?: string;
  layoutMode: 'none' | 'row' | 'column';
  width?: number;
  height?: number;
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
  frames: FigmaNodeView[];
  stats: { textNodes: number; mappedKeys: number; totalNodes: number };
  warning?: string;
}

export interface FigmaMcpStatus {
  connected: boolean;
  tools: string[];
  tokenPresent: boolean;
  transport: 'stdio';
  serverCommand: string;
  lastError: string | null;
  lastSource: FigmaSource | null;
}

/** components-map.json 항목 (파이프라인 산출물) */
export interface ComponentMapEntry {
  type: string;
  key: string;
  originalText: string;
  layout?: { x: number; y: number; width: number; height: number };
  parentName?: string;
  fontSize?: number | null;
}

export interface ComponentMapFrame {
  frame: string;
  frameId: string;
  children: ComponentMapEntry[];
}
