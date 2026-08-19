import { useState } from 'react';

interface PaginationProps {
  totalItems: number;
  pageSize?: number;
  onPageChange: (startIdx: number, endIdx: number) => void;
}

function Pagination({ totalItems, pageSize = 20, onPageChange }: PaginationProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(totalItems / pageSize);

  const handlePageChange = (page: number) => {
    const newPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(newPage);
    const start = (newPage - 1) * pageSize;
    const end = Math.min(start + pageSize, totalItems);
    onPageChange(start, end);
  };

  // 표시할 페이지 버튼 범위 계산
  const getPageNumbers = (): number[] => {
    const pages: number[] = [];
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    const endPage = Math.min(totalPages, startPage + maxVisible - 1);
    startPage = Math.max(1, endPage - maxVisible + 1);

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  };

  if (totalPages <= 1) return null;

  return (
    <div className="pagination">
      <button
        className="page-btn"
        disabled={currentPage === 1}
        onClick={() => handlePageChange(currentPage - 1)}
      >
        ←
      </button>
      {getPageNumbers().map((page) => (
        <button
          key={page}
          className={`page-btn ${currentPage === page ? 'active' : ''}`}
          onClick={() => handlePageChange(page)}
        >
          {page}
        </button>
      ))}
      <button
        className="page-btn"
        disabled={currentPage === totalPages}
        onClick={() => handlePageChange(currentPage + 1)}
      >
        →
      </button>
      <span className="page-info">
        {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, totalItems)} / {totalItems}
      </span>
    </div>
  );
}

export default Pagination;

/** Hook for easy pagination */
export function usePagination<T>(items: T[], pageSize = 20) {
  const [range, setRange] = useState({ start: 0, end: pageSize });

  const paginatedItems = items.slice(range.start, range.end);

  const handlePageChange = (start: number, end: number) => {
    setRange({ start, end });
  };

  return { paginatedItems, handlePageChange, totalItems: items.length, pageSize };
}
