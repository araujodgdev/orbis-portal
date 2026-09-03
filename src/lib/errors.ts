export function reqId(): string {
  return Math.random().toString(36).slice(2, 10);
}
export function err(c: unknown, code = 'internal', status = 500) {
  const requestId = reqId();
  console.error(JSON.stringify({ requestId, code, detail: String(c) }));
  return Response.json({ error: code, code, requestId }, { status });
}
