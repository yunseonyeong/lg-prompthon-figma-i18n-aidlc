/**
 * Figma 프레임 렌더러
 *
 * 서버가 MCP로 가져온 정규화 구조(FigmaNodeView)를 그대로 DOM으로 그린다.
 * 핵심: TEXT 노드는 Figma 원문이 아니라 매핑된 i18n 키로 t()를 호출한다.
 *       → 언어를 바꾸면 "실제 Figma 레이아웃 위에서" 텍스트가 교체된다.
 *
 * 하드코딩된 화면을 대체하는 컴포넌트다. 여기에 프레임별 분기를 추가하지 말 것.
 */

import { CSSProperties, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { FigmaNodeView } from '../types/figma';

interface FigmaFrameRendererProps {
  node: FigmaNodeView;
  /** i18n 키가 매핑된 텍스트에 점선 표시 (연동 확인용) */
  highlightMapped?: boolean;
  /** 프레임 원본 너비를 컨테이너 폭에 맞게 축소 */
  fitWidth?: number;
}

/** Figma 노드 타입 중 시각적으로 의미 없는 것들 */
const SKIPPED_TYPES = new Set(['SLICE']);

function toStyle(node: FigmaNodeView, isRoot: boolean): CSSProperties {
  const style: CSSProperties = {};

  // Auto Layout이 명시된 컨테이너에만 flex를 적용한다.
  // !== 'none'으로 판정하면 layoutMode가 없는 노드(특히 TEXT)까지
  // display:flex; flex-direction:column이 붙어 텍스트 렌더링이 망가진다.
  const isFlex =
    node.type !== 'TEXT' && (node.layoutMode === 'row' || node.layoutMode === 'column');
  if (isFlex) {
    style.display = 'flex';
    style.flexDirection = node.layoutMode === 'row' ? 'row' : 'column';
    if (node.gap) style.gap = node.gap;
    if (node.alignItems) style.alignItems = node.alignItems;
    if (node.justifyContent) style.justifyContent = node.justifyContent;
  }

  if (node.padding) style.padding = node.padding;
  if (node.backgroundColor) style.background = node.backgroundColor;
  if (node.borderRadius) style.borderRadius = node.borderRadius;
  if (node.borderColor) style.border = `1px solid ${node.borderColor}`;
  if (typeof node.opacity === 'number') style.opacity = node.opacity;

  if (node.type === 'TEXT') {
    if (node.fontSize) style.fontSize = `${node.fontSize}px`;
    if (node.fontWeight) style.fontWeight = node.fontWeight;
    if (node.textColor) style.color = node.textColor;
    style.lineHeight = 1.4;
    style.whiteSpace = 'pre-wrap';
  }

  // 루트 프레임만 고정 크기를 적용한다.
  // 자식까지 절대 크기를 주면 번역으로 길어진 텍스트가 잘린다 (i18n 데모의 핵심 결함).
  if (isRoot) {
    if (node.width) style.width = `${node.width}px`;
    if (node.height) style.minHeight = `${node.height}px`;
  } else if (node.type !== 'TEXT' && node.width && node.layoutMode === 'none') {
    style.minWidth = `${Math.min(node.width, 240)}px`;
  }

  return style;
}

function FigmaNode({
  node,
  isRoot,
  highlightMapped,
}: {
  node: FigmaNodeView;
  isRoot: boolean;
  highlightMapped: boolean;
}) {
  const { t } = useTranslation();

  if (SKIPPED_TYPES.has(node.type)) return null;

  const style = toStyle(node, isRoot);

  if (node.type === 'TEXT') {
    // i18n 키가 있으면 번역값, 없으면 Figma 원문을 그대로 보여준다.
    //
    // 키가 없는 텍스트를 "오류"로 표시하지 않는 이유:
    // 파이프라인이 UX 시나리오 설명 테이블, 숫자/날짜, placeholder 등을
    // 의도적으로 번역 대상에서 제외한다. 이들은 정상적으로 키가 없다.
    // 따라서 중립적으로 "i18n 미적용"으로만 구분한다.
    const label = node.i18nKey ? t(node.i18nKey) : node.text;
    const mapped = Boolean(node.i18nKey);
    return (
      <span
        style={{
          ...style,
          ...(highlightMapped && mapped
            ? { outline: '1px dashed rgba(13,110,253,.45)', outlineOffset: 2 }
            : {}),
          ...(highlightMapped && !mapped && node.text
            ? { outline: '1px dashed rgba(108,117,125,.35)', outlineOffset: 2 }
            : {}),
        }}
        title={
          node.i18nKey
            ? `${node.i18nKey}\n(Figma 원문: ${node.text})`
            : `i18n 미적용 — Figma 원문 표시\n${node.text}`
        }
        data-figma-id={node.id}
        data-i18n-key={node.i18nKey}
      >
        {label}
      </span>
    );
  }

  const children = node.children ?? [];
  if (children.length === 0 && !node.backgroundColor && !node.borderColor) {
    // 내용도 스타일도 없는 빈 컨테이너는 그리지 않는다.
    return null;
  }

  return (
    <div style={style} data-figma-id={node.id} data-figma-name={node.name}>
      {children.map((child) => (
        <FigmaNode
          key={child.id}
          node={child}
          isRoot={false}
          highlightMapped={highlightMapped}
        />
      ))}
    </div>
  );
}

function FigmaFrameRenderer({
  node,
  highlightMapped = false,
  fitWidth,
}: FigmaFrameRendererProps) {
  // 프레임 원본 폭이 컨테이너보다 넓으면 축소해서 전체가 보이도록 한다.
  const scale = useMemo(() => {
    if (!fitWidth || !node.width || node.width <= fitWidth) return 1;
    return fitWidth / node.width;
  }, [fitWidth, node.width]);

  return (
    <div
      style={{
        overflow: 'auto',
        // transform scale은 레이아웃 공간을 차지하지 않으므로 높이를 보정한다.
        height: node.height ? `${node.height * scale}px` : undefined,
      }}
    >
      <div
        style={{
          transform: scale === 1 ? undefined : `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        <FigmaNode node={node} isRoot highlightMapped={highlightMapped} />
      </div>
    </div>
  );
}

export default FigmaFrameRenderer;
