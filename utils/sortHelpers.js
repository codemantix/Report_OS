export function compareValues(a, b, direction = 'asc') {
  const multiplier = direction === 'desc' ? -1 : 1;
  const aValue = a === null || a === undefined ? '' : a;
  const bValue = b === null || b === undefined ? '' : b;

  if (aValue instanceof Date || bValue instanceof Date) {
    return (new Date(aValue).getTime() - new Date(bValue).getTime()) * multiplier;
  }

  if (typeof aValue === 'number' || typeof bValue === 'number') {
    return (Number(aValue || 0) - Number(bValue || 0)) * multiplier;
  }

  return String(aValue).localeCompare(String(bValue)) * multiplier;
}

export function sortItems(items = [], selector, direction = 'asc') {
  if (!selector) return items;
  return [...items].sort((a, b) => compareValues(selector(a), selector(b), direction));
}
