/**
 * 스켈레톤 UI 테스트
 *
 * 검증 관점 두 가지:
 *   1) 접근성 — 로딩 상태가 보조기술에 전달되고, 장식 요소는 감춰지는가
 *   2) 레이아웃 안정성 — 실제 표와 같은 행/열 수를 그려 완료 시 레이아웃이 튀지 않는가
 */

// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  Skeleton,
  SkeletonList,
  SkeletonRegion,
  SkeletonStatCards,
  SkeletonTable,
  SkeletonText,
} from './Skeleton';

afterEach(cleanup);

describe('SkeletonRegion', () => {
  it('로딩 상태를 보조기술에 알린다', () => {
    render(
      <SkeletonRegion label="번역 결과를 불러오는 중">
        <Skeleton width={100} />
      </SkeletonRegion>
    );

    const region = screen.getByRole('status');
    expect(region.getAttribute('aria-busy')).toBe('true');
    // 화면에는 안 보이지만 스크린리더가 읽을 텍스트
    expect(screen.getByText('번역 결과를 불러오는 중')).toBeTruthy();
  });

  it('장식용 스켈레톤은 aria-hidden으로 감춘다', () => {
    const { container } = render(
      <SkeletonRegion>
        <Skeleton width={100} />
      </SkeletonRegion>
    );

    // 스켈레톤 블록이 aria-hidden 컨테이너 안에 있어야 한다.
    // 그렇지 않으면 스크린리더가 의미 없는 요소를 훑는다.
    const hidden = container.querySelector('[aria-hidden="true"]');
    expect(hidden).toBeTruthy();
    expect(hidden!.querySelector('.ux-skeleton')).toBeTruthy();
  });
});

describe('Skeleton', () => {
  it('width/height를 스타일로 반영한다', () => {
    const { container } = render(<Skeleton width={120} height="2rem" />);
    const el = container.querySelector('.ux-skeleton') as HTMLElement;
    expect(el.style.width).toBe('120px');
    expect(el.style.height).toBe('2rem');
  });

  it('circle이면 원형 클래스를 붙인다', () => {
    const { container } = render(<Skeleton width={16} height={16} circle />);
    expect(container.querySelector('.ux-skeleton-circle')).toBeTruthy();
  });
});

describe('SkeletonTable', () => {
  it('요청한 행/열 수만큼 그린다 (레이아웃 이동 방지)', () => {
    const { container } = render(<SkeletonTable rows={15} columns={4} />);

    expect(container.querySelectorAll('thead th')).toHaveLength(4);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(15);
    expect(container.querySelectorAll('tbody tr:first-child td')).toHaveLength(4);
  });

  it('columnWidths로 열 폭을 고정할 수 있다', () => {
    const { container } = render(
      <SkeletonTable rows={2} columns={3} columnWidths={['50%', '30%', '20%']} />
    );
    const ths = Array.from(container.querySelectorAll('thead th')) as HTMLElement[];
    expect(ths.map((th) => th.style.width)).toEqual(['50%', '30%', '20%']);
  });

  it('showHeader=false면 헤더를 그리지 않는다', () => {
    const { container } = render(<SkeletonTable rows={2} columns={2} showHeader={false} />);
    expect(container.querySelector('thead')).toBeNull();
  });
});

describe('SkeletonText / SkeletonStatCards / SkeletonList', () => {
  it('SkeletonText는 마지막 줄을 짧게 그린다', () => {
    const { container } = render(<SkeletonText lines={3} lastLineWidth="60%" />);
    const bars = Array.from(container.querySelectorAll('.ux-skeleton')) as HTMLElement[];
    expect(bars).toHaveLength(3);
    expect(bars[0].style.width).toBe('100%');
    expect(bars[2].style.width).toBe('60%');
  });

  it('SkeletonStatCards는 카드 수를 맞춘다', () => {
    const { container } = render(<SkeletonStatCards count={4} />);
    expect(container.querySelectorAll('.card')).toHaveLength(4);
  });

  it('SkeletonList는 항목 수를 맞춘다', () => {
    const { container } = render(<SkeletonList items={5} />);
    expect(container.querySelectorAll('.list-group-item')).toHaveLength(5);
  });
});
