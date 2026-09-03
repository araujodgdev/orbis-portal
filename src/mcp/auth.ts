export async function verifyBearer(db: D1Database, header: string | undefined): Promise<string | null> {
  const m = (header ?? '').match(/^Bearer ([A-Za-z0-9_.-]+)$/);
  if (!m) return null;
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(m[1])))]
    .map((b) => b.toString(16).padStart(2, '0')).join('');
  const row = await db.prepare(`SELECT user_id FROM api_tokens WHERE token_hash = ? AND revogado_em IS NULL`)
    .bind(digest).first<{ user_id: string }>();
  return row?.user_id ?? null;
}
