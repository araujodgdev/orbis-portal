-- Seed demo — DEV/LOCAL ONLY. Never apply to the prod database.
-- Run once against a fresh local D1 (see README_DEPLOY.md step 5):
--   npm run db:migrate && npm run db:seed
-- Demo login: demo@escritorio.test / demo123 (pass_hash = sha256("orbis:demo123")).
INSERT INTO users (id, email, pass_hash, role) VALUES
  ('demo_usr_01', 'demo@escritorio.test', '7c300cf19ada734f25b20ad5aedf66c5cf6ee4909a56d28b1abfb92cdd705c84', 'escritorio');
-- Fixed demo_* ids on purpose: a second run fails on PRIMARY KEY,
-- which is the guardrail against accidental double-seeding.
INSERT INTO clientes (id, nome, contato, honorario_status, cpf_cnpj) VALUES
  ('demo_cli_01', 'Demo Silva', 'demo@escritorio.test', 'ativo', '12.345.678/0001-90');
INSERT INTO processos (id, cliente_id, numero_cnj, tribunal, fase, responsavel, area) VALUES
  ('demo_pro_01', 'demo_cli_01', '0000001-01.2026.8.26.0001', 'TJSP', 'conhecimento', 'Dra. Demo', 'civel');
INSERT INTO movimentacoes (id, processo_id, data, texto, lida) VALUES
  ('demo_mov_01', 'demo_pro_01', date('now'), 'Publicação no DJE: intimação para manifestação em 5 dias.', 0);
INSERT INTO prazos (id, processo_id, data, tipo) VALUES
  ('demo_prz_01', 'demo_pro_01', date('now', '+3 days'), 'manifestacao');
INSERT INTO noticias (id, titulo, link, resumo, area, fonte) VALUES
  ('demo_not_01', 'STJ fixa tese sobre honorários', 'https://example.test/stj', 'Resumo curado v1.', 'civel', 'Jusbrasil');
