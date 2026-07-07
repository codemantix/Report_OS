export function paginateItems(items = [], page = 1, pageSize = 10) {
  const safePageSize = Math.max(Number(pageSize) || 10, 1);
  const totalCount = items.length;
  const totalPages = Math.max(Math.ceil(totalCount / safePageSize), 1);
  const safePage = Math.min(Math.max(Number(page) || 1, 1), totalPages);
  const start = (safePage - 1) * safePageSize;

  return {
    data: items.slice(start, start + safePageSize),
    page: safePage,
    pageSize: safePageSize,
    totalCount,
    totalPages,
  };
}
