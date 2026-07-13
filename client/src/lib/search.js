export function normalizeSearch(str) {
  if (str == null) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '');
}

export function matchesSearch(text, query) {
  const nq = normalizeSearch(query);
  if (!nq) return true;
  return normalizeSearch(text).includes(nq);
}

export function equalsSearch(a, b) {
  return normalizeSearch(a) === normalizeSearch(b);
}
