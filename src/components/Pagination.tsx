import { useState } from 'react';
import { Pagination as BSPagination } from 'react-bootstrap';

interface PaginationProps {
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

function Pagination({ totalItems, pageSize, onPageChange }: PaginationProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(totalItems / pageSize);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    onPageChange(page);
  };

  if (totalPages <= 1) return null;

  const pages = [];
  const maxVisible = 5;
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  const end = Math.min(totalPages, start + maxVisible - 1);
  
  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1);
  }

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  return (
    <div className="d-flex justify-content-center align-items-center gap-3">
      <BSPagination size="sm" className="mb-0">
        <BSPagination.Prev
          disabled={currentPage === 1}
          onClick={() => handlePageChange(currentPage - 1)}
        />
        {start > 1 && (
          <>
            <BSPagination.Item onClick={() => handlePageChange(1)}>1</BSPagination.Item>
            {start > 2 && <BSPagination.Ellipsis disabled />}
          </>
        )}
        {pages.map((page) => (
          <BSPagination.Item
            key={page}
            active={page === currentPage}
            onClick={() => handlePageChange(page)}
          >
            {page}
          </BSPagination.Item>
        ))}
        {end < totalPages && (
          <>
            {end < totalPages - 1 && <BSPagination.Ellipsis disabled />}
            <BSPagination.Item onClick={() => handlePageChange(totalPages)}>
              {totalPages}
            </BSPagination.Item>
          </>
        )}
        <BSPagination.Next
          disabled={currentPage === totalPages}
          onClick={() => handlePageChange(currentPage + 1)}
        />
      </BSPagination>
      <span className="text-muted small">
        {totalItems} 항목 중 {(currentPage - 1) * pageSize + 1}-
        {Math.min(currentPage * pageSize, totalItems)}
      </span>
    </div>
  );
}

export default Pagination;

// usePagination hook
export function usePagination<T>(items: T[], pageSize: number) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedItems = items.slice(startIndex, startIndex + pageSize);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return {
    paginatedItems,
    currentPage,
    totalPages,
    totalItems,
    pageSize,
    handlePageChange,
  };
}
