/**
 * Figma 구조 → React(tsx) 코드 생성 (결정론적, LLM 호출 없음)
 *
 * ## 왜 EXAONE을 쓰지 않는가
 * 컴포넌트 생성과 미리보기가 서로 다른 경로로 돌면 결과가 어긋난다. 실측으로
 * LLM 경로는 같은 프레임에서 매번 다른 구조를 만들고(반복 루프, 없는 아이콘 import,
 * 단위 없는 '29x' 같은 값) 미리보기와 대조가 불가능했다.
 *
 * 그래서 이 모듈은 미리보기(FigmaFrameRenderer)가 DOM을 만드는 규칙을 그대로
 * JSX 문자열로 옮긴다. 같은 입력(figma-structure.json) → 같은 트리 → 같은 스타일.
 * 미리보기에서 보이는 화면이 곧 생성된 컴포넌트의 렌더 결과다.
 *
 * 대응 관계:
 *   FigmaFrameRenderer(mode='pixel')  ↔  emitNode()
 *   toStyle()                          ↔  nodeStyle()
 *   stripUxDocNodes()                  ↔  동일 함수 재사용 (UX 문서 요소 제외)
 */

import * as fs from 'fs';
import * as path from 'path';
import type { FigmaNodeView } from '../types/figma';
import { stripUxDocNodes } from '../utils/figmaPreview';

/** 시각적으로 의미 없는 노드 (미리보기 SKIPPED_TYPES + 아이콘 path류) */
const SKIPPED_TYPES = new Set(['SLICE', 'VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'LINE']);

export interface GeneratedComponentFile {
  name: string;
  fileName: string;
  code: string;
  /** 원본 Figma 프레임 이름 */
  frame: string;
  stats: { nodes: number; texts: number; mappedKeys: number };
}

export interface CodegenResult {
  components: GeneratedComponentFile[];
  failures: string[];
}

// ===== 입력 로딩 =====

/**
 * figma-structure.json을 읽는다.
 *
 * 이 경로에는 두 가지 형식이 쓰인다 (서로 덮어쓴다):
 *   1) 서버 MCP 캐시   → { source, frames: FigmaNodeView[], stats, ... }
 *   2) 파이프라인 Step 6 → FigmaFrameStructure[] (절대 좌표, Figma raw에 가까운 형태)
 * 둘 다 받아서 FigmaNodeView 트리로 통일한다.
 */
export function loadStructureFrames(filePath: string): FigmaNodeView[] {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  if (raw && Array.isArray(raw.frames)) return raw.frames as FigmaNodeView[];
  if (Array.isArray(raw)) return raw.map((f: any) => pipelineStructureToNodeView(f));

  throw new Error('figma-structure.json 형식을 알 수 없습니다 (frames 배열이 없습니다)');
}

/** 파이프라인 FigmaFrameStructure → FigmaNodeView (좌표는 부모 기준 상대값으로 변환) */
function pipelineStructureToNodeView(
  s: any,
  parent?: { x: number; y: number }
): FigmaNodeView {
  const layout = s.layout ?? {};
  const view: FigmaNodeView = {
    id: String(s.id ?? ''),
    name: String(s.name ?? ''),
    type: String(s.type ?? 'FRAME'),
    layoutMode:
      s.layoutMode === 'HORIZONTAL' ? 'row' : s.layoutMode === 'VERTICAL' ? 'column' : 'none',
  };

  if (typeof layout.width === 'number' && layout.width > 0) view.width = Math.round(layout.width);
  if (typeof layout.height === 'number' && layout.height > 0) view.height = Math.round(layout.height);
  if (parent && typeof layout.x === 'number' && typeof layout.y === 'number') {
    view.x = Math.round(layout.x - parent.x);
    view.y = Math.round(layout.y - parent.y);
  }

  if (s.padding) {
    const p = s.padding;
    if (p.top || p.right || p.bottom || p.left) {
      view.padding = `${p.top || 0}px ${p.right || 0}px ${p.bottom || 0}px ${p.left || 0}px`;
    }
  }
  if (typeof s.itemSpacing === 'number' && s.itemSpacing > 0) view.gap = `${s.itemSpacing}px`;
  if (typeof s.cornerRadius === 'number' && s.cornerRadius > 0) {
    view.borderRadius = `${s.cornerRadius}px`;
  }

  const color = firstFillColor(s.fills);
  if (color) {
    if (view.type === 'TEXT') view.textColor = color;
    else view.backgroundColor = color;
  }

  if (typeof s.text === 'string' && s.text.trim()) view.text = s.text.trim();
  if (typeof s.fontSize === 'number') view.fontSize = s.fontSize;
  if (typeof s.fontWeight === 'number') view.fontWeight = s.fontWeight;
  if (typeof s.i18nKey === 'string') view.i18nKey = s.i18nKey;

  if (Array.isArray(s.children) && s.children.length > 0) {
    const self =
      typeof layout.x === 'number' && typeof layout.y === 'number'
        ? { x: layout.x, y: layout.y }
        : parent;
    view.children = s.children.map((c: any) => pipelineStructureToNodeView(c, self));
  }

  return view;
}

function firstFillColor(fills: any): string | null {
  if (!Array.isArray(fills)) return null;
  for (const f of fills) {
    const c = f?.color;
    if (!c) continue;
    const r = Math.round((c.r ?? 0) * 255);
    const g = Math.round((c.g ?? 0) * 255);
    const b = Math.round((c.b ?? 0) * 255);
    const a = c.a ?? 1;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  return null;
}

/**
 * components-map.json으로 텍스트→키를 보완한다.
 *
 * 서버 payload에는 i18nKey가 이미 붙어 있지만, 파이프라인이 쓴 형식에는 없다.
 * 원문 완전일치로 채운다 (미리보기 서버가 하는 것과 같은 규칙).
 */
export function applyKeysFromComponentsMap(frames: FigmaNodeView[], mapPath: string): number {
  let filled = 0;
  let textToKey: Map<string, string>;
  try {
    const map = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
    textToKey = new Map();
    for (const frame of map ?? []) {
      for (const child of frame.children ?? []) {
        if (child.originalText && child.key && !textToKey.has(child.originalText)) {
          textToKey.set(child.originalText, child.key);
        }
      }
    }
  } catch {
    return 0;
  }

  const walk = (n: FigmaNodeView) => {
    if (n.text && !n.i18nKey) {
      const key = textToKey.get(n.text);
      if (key) {
        n.i18nKey = key;
        filled++;
      }
    }
    for (const c of n.children ?? []) walk(c);
  };
  for (const f of frames) walk(f);
  return filled;
}

// ===== 이름 =====

function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

/**
 * 프레임 이름 → 컴포넌트 이름.
 * 이름이 "-"처럼 영숫자를 포함하지 않으면 빈 문자열이 되므로 노드 id로 대체한다.
 */
export function componentNameFor(node: FigmaNodeView, fallbackIndex = 0): string {
  const fromName = toPascalCase(node.name);
  if (/^[A-Za-z][A-Za-z0-9]*$/.test(fromName)) return fromName;
  const fromId = node.id ? node.id.replace(/[^A-Za-z0-9]+/g, '_') : '';
  return fromId ? `Frame${fromId}` : `GeneratedFrame${fallbackIndex + 1}`;
}

// ===== 스타일 =====

/**
 * px 값을 정수로 다듬는다.
 *
 * MCP가 주는 값에는 `5.189189434051514px`처럼 소수점이 길게 붙은 것이 섞여 있다.
 * 렌더 결과는 사실상 같으므로 코드에서는 읽을 수 있게 반올림한다.
 */
function roundPx(value: string): string {
  return value.replace(/(-?\d+\.\d+)px/g, (_m, n) => `${Math.round(Number(n))}px`);
}

/** JSX style 객체 문자열 (`{ position: 'absolute', left: '32px' }`) */
function styleLiteral(style: Record<string, string | number>): string {
  const entries = Object.entries(style);
  if (entries.length === 0) return '';
  const body = entries
    .map(([k, v]) => `${k}: ${typeof v === 'number' ? v : JSON.stringify(v)}`)
    .join(', ');
  return `{{ ${body} }}`;
}

/**
 * 미리보기 toStyle()과 같은 규칙으로 스타일을 만든다.
 *
 * - 좌표(x/y)가 있는 노드 → absolute + left/top + Figma 크기
 * - 좌표가 없으면 Auto Layout(flex) 흐름 배치로 폴백
 * - TEXT는 height를 고정하지 않는다 (번역이 길어지면 잘리므로 minHeight)
 */
function nodeStyle(
  node: FigmaNodeView,
  isRoot: boolean,
  positioned: boolean
): Record<string, string | number> {
  const style: Record<string, string | number> = {};

  const childrenPositioned = (node.children ?? []).some(
    (c) => typeof c.x === 'number' && typeof c.y === 'number'
  );
  const isFlex =
    !childrenPositioned &&
    node.type !== 'TEXT' &&
    (node.layoutMode === 'row' || node.layoutMode === 'column');

  if (isFlex) {
    style.display = 'flex';
    style.flexDirection = node.layoutMode === 'row' ? 'row' : 'column';
    if (node.gap) style.gap = roundPx(node.gap);
    if (node.alignItems) style.alignItems = node.alignItems;
    if (node.justifyContent) style.justifyContent = node.justifyContent;
  }
  if (childrenPositioned || isRoot) style.position = 'relative';

  if (node.padding) style.padding = roundPx(node.padding);
  if (node.backgroundColor) style.background = node.backgroundColor;
  if (node.borderRadius) style.borderRadius = roundPx(node.borderRadius);
  if (node.borderColor) style.border = `1px solid ${node.borderColor}`;
  if (typeof node.opacity === 'number' && node.opacity < 1) style.opacity = node.opacity;

  if (node.type === 'TEXT') {
    if (node.fontSize) style.fontSize = `${node.fontSize}px`;
    if (node.fontWeight) style.fontWeight = node.fontWeight;
    if (node.textColor) style.color = node.textColor;
    style.lineHeight = 1.4;
    style.whiteSpace = 'pre-wrap';
  }

  if (positioned) {
    style.position = 'absolute';
    style.left = `${node.x}px`;
    style.top = `${node.y}px`;
    if (node.width) style.width = `${node.width}px`;
    if (node.height) {
      if (node.type === 'TEXT') style.minHeight = `${node.height}px`;
      else style.height = `${node.height}px`;
    }
    return style;
  }

  if (isRoot) {
    if (node.width) style.width = `${node.width}px`;
    if (node.height) style.minHeight = `${node.height}px`;
  }

  return style;
}

// ===== JSX 생성 =====

interface EmitContext {
  usesTranslation: boolean;
  nodes: number;
  texts: number;
  mappedKeys: number;
}

function emitNode(
  node: FigmaNodeView,
  isRoot: boolean,
  positioned: boolean,
  depth: number,
  ctx: EmitContext
): string[] {
  if (SKIPPED_TYPES.has(node.type)) return [];

  const indent = '  '.repeat(depth);
  const style = styleLiteral(nodeStyle(node, isRoot, positioned));
  const styleAttr = style ? ` style=${style}` : '';

  if (node.type === 'TEXT') {
    ctx.nodes++;
    ctx.texts++;
    // 미리보기와 동일: 키가 있으면 t(key), 없으면 Figma 원문을 그대로 둔다.
    let content: string;
    if (node.i18nKey) {
      ctx.usesTranslation = true;
      ctx.mappedKeys++;
      content = `{t(${JSON.stringify(node.i18nKey)})}`;
    } else {
      content = `{${JSON.stringify(node.text ?? '')}}`;
    }
    return [`${indent}<span${styleAttr} data-figma-id=${JSON.stringify(node.id)}>${content}</span>`];
  }

  const children = (node.children ?? []).filter((c) => !SKIPPED_TYPES.has(c.type));
  const hasVisual = Boolean(node.backgroundColor || node.borderColor);
  if (children.length === 0 && !hasVisual) return [];

  ctx.nodes++;
  const open = `${indent}<div${styleAttr} data-figma-id=${JSON.stringify(node.id)}>`;
  if (children.length === 0) {
    return [`${open.slice(0, -1)} />`];
  }

  const lines = [open];
  for (const child of children) {
    lines.push(
      ...emitNode(
        child,
        false,
        typeof child.x === 'number' && typeof child.y === 'number',
        depth + 1,
        ctx
      )
    );
  }
  lines.push(`${indent}</div>`);
  return lines;
}

export interface GenerateOptions {
  /** UX 시나리오 문서 요소(No/Classification/Description 표, 장표 제목) 제외 */
  stripDocNodes?: boolean;
  /** 코드 주석에 남길 입력 출처 */
  sourceNote?: string;
}

/** 프레임 1개 → tsx 코드 */
export function generateComponentTsx(
  frame: FigmaNodeView,
  componentName: string,
  opts: GenerateOptions = {}
): GeneratedComponentFile {
  const { stripDocNodes = true, sourceNote } = opts;

  // 미리보기와 같은 정리 규칙을 적용한다 (장표 래퍼 → 실제 화면 프레임)
  const target = stripDocNodes ? stripUxDocNodes(frame).frame : frame;

  const ctx: EmitContext = { usesTranslation: false, nodes: 0, texts: 0, mappedKeys: 0 };
  const body = emitNode(target, true, false, 3, ctx);

  const header = [
    '/**',
    ` * ${componentName} — Figma 구조에서 자동 생성된 컴포넌트`,
    ' *',
    ` * 원본 프레임: ${target.name} (${target.id})${
      target.width && target.height ? ` ${target.width}x${target.height}` : ''
    }`,
    sourceNote ? ` * 입력: ${sourceNote}` : null,
    ` * 노드 ${ctx.nodes}개 / 텍스트 ${ctx.texts}개 (i18n 키 ${ctx.mappedKeys}개)`,
    ' *',
    ' * 이 파일은 Step 6 미리보기(FigmaFrameRenderer)와 같은 규칙으로 생성됩니다.',
    ' * 좌표가 있는 노드는 Figma px 그대로 absolute 배치하고, 없으면 Auto Layout으로 흐릅니다.',
    ' * 직접 수정하면 다음 생성에서 덮어써집니다.',
    ' */',
  ].filter((l): l is string => l !== null);

  const imports = ctx.usesTranslation ? [`import { useTranslation } from 'react-i18next';`, ''] : [];
  const hook = ctx.usesTranslation ? ['  const { t } = useTranslation();', ''] : [];

  const code = [
    ...header,
    '',
    ...imports,
    `function ${componentName}() {`,
    ...hook,
    '  return (',
    ...body,
    '  );',
    '}',
    '',
    `export default ${componentName};`,
    '',
  ].join('\n');

  return {
    name: componentName,
    fileName: `${componentName}.tsx`,
    code,
    frame: target.name,
    stats: { nodes: ctx.nodes, texts: ctx.texts, mappedKeys: ctx.mappedKeys },
  };
}

/**
 * figma-structure.json → 컴포넌트 코드 일괄 생성.
 *
 * 미리보기와 같은 파일을 입력으로 쓰기 때문에 두 단계가 어긋나지 않는다.
 */
export function generateComponentsFromStructure(opts: {
  structurePath: string;
  componentsMapPath?: string;
  stripDocNodes?: boolean;
}): CodegenResult {
  const { structurePath, componentsMapPath, stripDocNodes = true } = opts;

  if (!fs.existsSync(structurePath)) {
    return {
      components: [],
      failures: [
        `${path.basename(structurePath)}이 없습니다. Step 6 미리보기에서 "MCP로 다시 가져오기"를 실행하거나 파이프라인을 먼저 돌리세요.`,
      ],
    };
  }

  let frames: FigmaNodeView[];
  try {
    frames = loadStructureFrames(structurePath);
  } catch (e) {
    return { components: [], failures: [e instanceof Error ? e.message : String(e)] };
  }
  if (frames.length === 0) {
    return { components: [], failures: ['구조 파일에 프레임이 없습니다.'] };
  }

  if (componentsMapPath) {
    const filled = applyKeysFromComponentsMap(frames, componentsMapPath);
    if (filled > 0) console.log(`   i18n 키 보완: ${filled}건 (components-map.json)`);
  }

  const components: GeneratedComponentFile[] = [];
  const failures: string[] = [];
  const used = new Set<string>();

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    // 문서 요소를 걷어낸 뒤의 프레임 이름으로 컴포넌트 이름을 정한다
    const target = stripDocNodes ? stripUxDocNodes(frame).frame : frame;
    let name = componentNameFor(target, i);
    while (used.has(name)) name = `${name}2`;
    used.add(name);

    try {
      const generated = generateComponentTsx(frame, name, {
        stripDocNodes,
        sourceNote: path.basename(structurePath),
      });
      if (generated.stats.nodes === 0) {
        failures.push(`${name}: 렌더할 노드가 없습니다`);
        continue;
      }
      components.push(generated);
    } catch (e) {
      failures.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { components, failures };
}
