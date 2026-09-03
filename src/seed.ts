// src/seed.ts
export async function seedDemo(db: D1Database): Promise<{ clientes: number; processos: number }> {
  const cid = `cli_${Math.random().toString(36).slice(2, 8)}`;
  await db.prepare(`INSERT INTO clientes (id, nome, contato) VALUES (?, ?, ?)`)
    .bind(cid, 'Demo Silva', 'demo@escritorio.test').run();
  const pid = `pro_${Math.random().toString(36).slice(2, 8)}`;
  await db.prepare(
    `INSERT INTO processos (id, cliente_id, numero_cnj, tribunal, fase, responsavel, area) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(pid, cid, '0000001-01.2026.8.26.0001', 'TJSP', 'conhecimento', 'Dra. Demo', 'civel').run();
  const today = new Date().toISOString().slice(0, 10);
  await db.prepare(`INSERT INTO movimentacoes (id, processo_id, data, texto, lida) VALUES (?, ?, ?, ?, 0)`)
    .bind(`mov_${Date.now()}`, pid, today, 'Publicação no DJE: intimação para manifestação em 5 dias.').run();
  const soon = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
  await db.prepare(`INSERT INTO prazos (id, processo_id, data, tipo) VALUES (?, ?, ?, ?)`)
    .bind(`prz_${Date.now()}`, pid, soon, 'manifestacao').run();
  await db.prepare(`INSERT INTO noticias (id, titulo, link, resumo, area, fonte) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(`not_${Date.now()}`, 'STJ fixa tese sobre honorários', 'https://example.test/stj', 'Resumo curado v1.', 'civel', 'Jusbrasil').run();
  return { clientes: 1, processos: 1 };
}
