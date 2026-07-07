import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './PaginationControls.module.css';

const DEFAULT_PAGE_SIZES = [10, 15, 25, 50];

function getPageNumbers(page, totalPages) {
  const pages = [];
  const maxVisible = 5;

  if (totalPages <= maxVisible) {
    for (let i = 1; i <= totalPages; i += 1) pages.push(i);
    return pages;
  }

  pages.push(1);
  let start = Math.max(2, page - 1);
  let end = Math.min(totalPages - 1, page + 1);

  if (page <= 2) {
    start = 2;
    end = Math.min(4, totalPages - 1);
  } else if (page >= totalPages - 1) {
    start = Math.max(totalPages - 3, 2);
    end = totalPages - 1;
  }

  if (start > 2) pages.push('...');
  for (let i = start; i <= end; i += 1) pages.push(i);
  if (end < totalPages - 1) pages.push('...');
  pages.push(totalPages);
  return pages;
}

export default function PaginationControls({
  page,
  pageSize,
  totalCount,
  totalPages,
  onPageChange,
  onPageSizeChange,
  pageSizes = DEFAULT_PAGE_SIZES,
}) {
  if (!totalCount || totalCount <= 0) return null;

  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalCount);
  const pageNumbers = getPageNumbers(page, totalPages || 1);

  return (
    <div className={styles.pagination}>
      <div className={styles.paginationInfo}>Showing {startItem}–{endItem} of {totalCount}</div>
      <div className={styles.paginationRight}>
        <div className={styles.pageSizeWrap}>
          <label className={styles.paginationLabel}>Rows per page:</label>
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange?.(Number(event.target.value))}
            className={styles.perPageSelect}
          >
            {pageSizes.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
        <div className={styles.paginationButtons}>
          <button
            type="button"
            onClick={() => onPageChange?.(page - 1)}
            disabled={page <= 1}
            className={styles.pageBtn}
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {pageNumbers.map((item, index) =>
            item === '...' ? (
              <span key={`ellipsis-${index}`} className={styles.paginationEllipsis}>…</span>
            ) : (
              <button
                type="button"
                key={item}
                onClick={() => onPageChange?.(item)}
                className={item === page ? styles.pageBtnActive : styles.pageBtn}
              >
                {item}
              </button>
            )
          )}
          <button
            type="button"
            onClick={() => onPageChange?.(page + 1)}
            disabled={page >= totalPages}
            className={styles.pageBtn}
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
