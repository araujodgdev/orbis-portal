const CNJ_RE = /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/;
export function isCNJ(s: string): boolean {
  if (typeof s !== 'string') return false;
  return CNJ_RE.test(s.trim());
}

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export function isDateYYYYMMDD(s: string): boolean {
  if (typeof s !== 'string') return false;
  const t = s.trim();
  if (!DATE_RE.test(t)) return false;
  const d = new Date(`${t}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === t;
}
