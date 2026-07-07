export function normalizeSearchTerm(search) {
  return String(search || '')
    .trim()
    .replace(/[%,()]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 100);
}

export function hasSearch(search) {
  return normalizeSearchTerm(search).length > 0;
}

export function ilikePattern(search) {
  const term = normalizeSearchTerm(search);
  return term ? `%${term}%` : null;
}

export function buildIlikeClauses(fields, search) {
  const pattern = ilikePattern(search);
  if (!pattern) return [];
  return fields.map((field) => `${field}.ilike.${pattern}`);
}

export function buildInClause(field, values = []) {
  const uniqueValues = [...new Set((values || []).filter(Boolean))];
  if (uniqueValues.length === 0) return null;
  return `${field}.in.(${uniqueValues.join(',')})`;
}

export function applySearchOr(query, clauses = []) {
  const validClauses = clauses.filter(Boolean);
  return validClauses.length > 0 ? query.or(validClauses.join(',')) : query;
}

export function matchesText(value, search) {
  const term = normalizeSearchTerm(search).toLowerCase();
  if (!term) return true;
  return String(value || '').toLowerCase().includes(term);
}
