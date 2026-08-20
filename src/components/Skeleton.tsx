/**
 * 스켈레톤 UI
 *
 * ## 왜 스피너가 아니라 스켈레톤인가
 *
 * 이 앱의 여러 화면이 응답 전에 "빈 상태"를 먼저 렌더했다.
 * 예: StepInput은 existingFiles가 []로 시작하므로 응답이 오기 전
 *     "아직 생성된 데이터가 없습니다"가 스쳤다가 사라진다 (false negative).
 * 스켈레톤은 최종 레이아웃과 같은 골격을 미리 그려 이 깜빡임과
 * 레이아웃 이동(layout shift)을 함께 없앤다.
 *
 * ## 구현 방식
 *
 * Bootstrap 5의 .placeholder 를 쓰지 않고 자체 클래스(.ux-skeleton)를 쓴다.
 * .placeholder 는 `opacity`와 `currentColor` 기반이라 배경색 대비를 제어하기 어렵고,
 * .placeholder-glow 의 애니메이션이 전체 요소 투명도를 흔들어 텍스트와 섞이면 산만하다.
 * 대신 gradient shimmer를 쓰고 prefers-reduced-motion을 존중한다 (global.css).
 *
 * ## 접근성
 *
 * 스켈레톤 자체는 의미 없는 장식이므로 aria-hidden 으로 감춘다.
 * 대신 컨테이너에 role="status" + aria-busy 와 화면에 안 보이는 텍스트를 넣어
 * 스크린리더가 "불러오는 중"을 한 번 읽도록 한다.
 */

import type { CSSProperties, ReactNode } from 'react';

interface SkeletonRootProps {
  /** 스크린리더에 읽힐 로딩 설명 */
  label?: string;
  children: ReactNode;
  className?: string;
}

/** 스켈레톤 묶음을 감싸는 컨테이너. 로딩 상태를 보조기술에 알린다. */
export function SkeletonRegion({ label = '불러오는 중', children, className }: SkeletonRootProps) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="visually-hidden">{label}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

interface SkeletonBoxProps {
  width?: number | string;
  height?: number | string;
  /** 원형 (아바타/아이콘 자리) */
  circle?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** 기본 블록 1개 */
export function Skeleton({ width, height = '1rem', circle, className = '', style }: SkeletonBoxProps) {
  return (
    <span
      className={`ux-skeleton ${circle ? 'ux-skeleton-circle' : ''} ${className}`}
      style={{ width, height, ...style }}
    />
  );
}

/** 여러 줄 텍스트. 마지막 줄은 짧게 해서 문단처럼 보이게 한다. */
export function SkeletonText({
  lines = 3,
  lastLineWidth = '60%',
  gap = 8,
}: {
  lines?: number;
  lastLineWidth?: string;
  gap?: number;
}) {
  return (
    <span className="d-flex flex-column" style={{ gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? lastLineWidth : '100%'} height="0.85rem" />
      ))}
    </span>
  );
}

/**
 * 표 스켈레톤.
 * 실제 표와 같은 열 수/행 수를 넘겨야 로딩 → 완료 시 레이아웃이 튀지 않는다.
 */
export function SkeletonTable({
  rows = 8,
  columns = 4,
  /** 열별 폭 비율. 생략하면 균등 */
  columnWidths,
  showHeader = true,
}: {
  rows?: number;
  columns?: number;
  columnWidths?: string[];
  showHeader?: boolean;
}) {
  const widthAt = (i: number) => columnWidths?.[i] ?? `${Math.floor(100 / columns)}%`;

  return (
    <table className="table table-sm mb-0">
      {showHeader && (
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, c) => (
              <th key={c} style={{ width: widthAt(c) }}>
                <Skeleton width="70%" height="0.8rem" />
              </th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {Array.from({ length: rows }).map((_, r) => (
          <tr key={r}>
            {Array.from({ length: columns }).map((_, c) => (
              <td key={c}>
                {/* 행마다 폭을 조금씩 달리해 기계적으로 보이지 않게 한다 */}
                <Skeleton width={`${60 + ((r * 7 + c * 13) % 35)}%`} height="0.8rem" />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** 통계 카드 줄 (숫자 + 라벨) */
export function SkeletonStatCards({ count = 4 }: { count?: number }) {
  return (
    <div className="row g-3">
      {Array.from({ length: count }).map((_, i) => (
        <div className="col-sm-6 col-md-3" key={i}>
          <div className="card">
            <div className="card-body text-center py-3">
              <Skeleton width="45%" height="1.6rem" className="mb-2" />
              <Skeleton width="65%" height="0.75rem" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** 파일 목록 같은 리스트 */
export function SkeletonList({ items = 5 }: { items?: number }) {
  return (
    <ul className="list-group list-group-flush">
      {Array.from({ length: items }).map((_, i) => (
        <li className="list-group-item d-flex justify-content-between align-items-center" key={i}>
          <span className="d-flex align-items-center gap-2">
            <Skeleton width={18} height={18} circle />
            <Skeleton width={`${160 + ((i * 37) % 90)}px`} height="0.8rem" />
          </span>
          <span className="d-flex align-items-center gap-3">
            <Skeleton width={60} height="0.75rem" />
            <Skeleton width={54} height="1.25rem" style={{ borderRadius: 9999 }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** 미리보기 프레임처럼 큰 영역 */
export function SkeletonPanel({ height = 320 }: { height?: number }) {
  return <Skeleton width="100%" height={height} style={{ borderRadius: 8 }} />;
}

export default Skeleton;
