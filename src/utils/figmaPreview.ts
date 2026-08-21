/**
 * 미리보기용 Figma 트리 정리
 *
 * ## 왜 필요한가
 * 대상 Figma 프레임은 "UX 시나리오 장표"다. 실제 화면 프레임과 함께
 * 문서용 부속물이 형제로 들어 있다 — 실측(프레임 15682:100905, 1920x1703):
 *
 *   FRAME "Table"                        ← No/Classification/Description 설명 표
 *   FRAME ".Row"                         ← 그 표의 행
 *   INSTANCE "No" / "Doc Title"          ← 장표 번호 / 상단 제목
 *   FRAME "Console_Setting_Group@User"   ← 실제 화면 (전체 1,423 노드 중 1,360개)
 *
 * 이걸 그대로 그리면 미리보기에 설명 표와 장표 제목이 함께 나와서
 * "이게 화면인지 문서인지" 구분이 안 된다. 파이프라인도 같은 이유로 이 텍스트들을
 * 번역 대상에서 제외한다(isScenarioDescriptionTable).
 *
 * 서버 응답은 손대지 않는다. 원본 트리는 그대로 두고 화면에서만 걸러낸다.
 */

import type { FigmaNodeView } from '../types/figma';

/** 문서 부속물로 판단할 노드 이름 (완전일치, 대소문자 무시) */
const DOC_NODE_NAMES = new Set([
  'table',
  '.row',
  'row',
  'no',
  'no.',
  'doc title',
  'doc_title',
  'classification',
  'description',
]);

/** 설명 표의 컬럼 헤더 3종. 이 조합이 보이면 문서 표로 확정한다 */
const DOC_TABLE_HEADERS = ['no', 'classification', 'description'];

export function countNodes(node: FigmaNodeView): number {
  return 1 + (node.children ?? []).reduce((n, c) => n + countNodes(c), 0);
}

/** 노드 하위의 텍스트를 모아 소문자 목록으로 (헤더 판정용) */
function collectTexts(node: FigmaNodeView, acc: string[] = [], limit = 40): string[] {
  if (acc.length >= limit) return acc;
  if (node.text) acc.push(node.text.trim().toLowerCase().replace(/\.$/, ''));
  for (const c of node.children ?? []) collectTexts(c, acc, limit);
  return acc;
}

/**
 * No/Classification/Description 설명 표인가.
 *
 * 이름만으로 판단하지 않는다. 실제 화면에도 "Table"이라는 이름의 컨테이너가 있을 수 있어서,
 * 세 컬럼 헤더가 모두 보이는지까지 확인한다.
 */
export function isDocTable(node: FigmaNodeView): boolean {
  const texts = collectTexts(node);
  const hit = DOC_TABLE_HEADERS.filter((h) => texts.includes(h)).length;
  return hit >= 2;
}

/** 장표 문서 부속물(설명 표, 표 행, 장표 번호/제목)인가 */
export function isDocNode(node: FigmaNodeView): boolean {
  const name = node.name.trim().toLowerCase();
  if (DOC_NODE_NAMES.has(name)) return true;
  // 이름이 달라도 컬럼 헤더 조합이 보이면 설명 표다
  if (isDocTable(node)) return true;
  return false;
}

/**
 * 페이지 래퍼에서 실제 화면 프레임을 골라낸다.
 *
 * 노드 수 점유율로 판단한다. 한 자식이 전체의 70% 이상이면 그게 화면이다
 * (실측: 1,360/1,423 = 96%). 판단이 서지 않으면 원본을 그대로 돌려준다 —
 * 잘못 파고들어 화면 일부를 잘라내는 것보다 낫다.
 */
export function pickScreenFrame(frame: FigmaNodeView): FigmaNodeView {
  const children = frame.children ?? [];
  if (children.length < 2) return frame;

  const total = countNodes(frame);
  let best: { node: FigmaNodeView; count: number } | null = null;
  for (const child of children) {
    const count = countNodes(child);
    if (!best || count > best.count) best = { node: child, count };
  }
  if (best && best.count / total >= 0.7) return best.node;
  return frame;
}

export interface StripResult {
  frame: FigmaNodeView;
  /** 화면 프레임으로 파고들었으면 그 이름 */
  pickedScreen: string | null;
  /** 제거한 문서 노드 이름 */
  removed: string[];
}

/**
 * 미리보기용으로 UX 문서 요소를 제거한 트리를 만든다.
 *
 * 1) 페이지 래퍼면 실제 화면 프레임으로 내려간다 (형제로 있던 설명 표/제목이 함께 빠진다)
 * 2) 그래도 남아 있는 문서 노드를 트리 전체에서 제거한다
 */
export function stripUxDocNodes(frame: FigmaNodeView): StripResult {
  const screen = pickScreenFrame(frame);
  const removed: string[] = [];

  const prune = (node: FigmaNodeView): FigmaNodeView => {
    const children = node.children ?? [];
    if (children.length === 0) return node;

    const kept = children.filter((c) => {
      if (isDocNode(c)) {
        removed.push(c.name || `(${c.type})`);
        return false;
      }
      return true;
    });

    return { ...node, children: kept.map(prune) };
  };

  return {
    frame: prune(screen),
    pickedScreen: screen === frame ? null : screen.name,
    removed,
  };
}
