import { filterBySearch } from './clientSearch';
import { sortItems } from './sortHelpers';

export function applyListSearchSortPagination({
  items = [],
  search,
  selectors = [],
  sortSelector,
  sortDirection = 'asc',
  page = 1,
  pageSize = 10,
}) {
  const filtered = filterBySearch(items, search, selectors);
  const sorted = sortItems(filtered, sortSelector, sortDirection);
  const safePageSize = Math.max(Number(pageSize) || 10, 1);
  const totalCount = sorted.length;
  const totalPages = Math.max(Math.ceil(totalCount / safePageSize), 1);
  const safePage = Math.min(Math.max(Number(page) || 1, 1), totalPages);
  const start = (safePage - 1) * safePageSize;

  return {
    data: sorted.slice(start, start + safePageSize),
    totalCount,
    totalPages,
    page: safePage,
    pageSize: safePageSize,
  };
}
