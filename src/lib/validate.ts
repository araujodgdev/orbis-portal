const CNJ_RE = /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/;
export function isCNJ(s: string): boolean {
  if (typeof s !== 'string') return false;
  return CNJ_RE.test(s.trim());
}
