import { normalizeSearchTerm } from './searchHelpers';

function flattenValue(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(flattenValue).join(' ');
  if (typeof value === 'object') return Object.values(value).map(flattenValue).join(' ');
  return String(value);
}

export function filterBySearch(items = [], search, selectors = []) {
  const term = normalizeSearchTerm(search).toLowerCase();
  if (!term) return items;

  return items.filter((item) =>
    selectors.some((selector) => flattenValue(selector(item)).toLowerCase().includes(term))
  );
}
