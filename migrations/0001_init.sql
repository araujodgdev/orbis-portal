CREATE TABLE IF NOT EXISTS clientes (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  contato TEXT NOT NULL DEFAULT '',
  honorario_status TEXT NOT NULL DEFAULT 'ativo',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS processos (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  numero_cnj TEXT NOT NULL UNIQUE,
  tribunal TEXT NOT NULL DEFAULT '',
  fase TEXT NOT NULL DEFAULT 'conhecimento',
  responsavel TEXT NOT NULL DEFAULT '',
  area TEXT NOT NULL DEFAULT 'civel',
  status TEXT NOT NULL DEFAULT 'ativo',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_processos_cnj ON processos(numero_cnj);
CREATE INDEX IF NOT EXISTS idx_processos_status ON processos(status, fase);
CREATE TABLE IF NOT EXISTS movimentacoes (
  id TEXT PRIMARY KEY,
  processo_id TEXT NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  texto TEXT NOT NULL,
  lida INTEGER NOT NULL DEFAULT 0,
  origem TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mov_proc_lida ON movimentacoes(processo_id, lida);
CREATE TABLE IF NOT EXISTS prazos (
  id TEXT PRIMARY KEY,
  processo_id TEXT NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'manifestacao',
  status TEXT NOT NULL DEFAULT 'aberto',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_prazos_data_status ON prazos(data, status);
CREATE TABLE IF NOT EXISTS documentos (
  id TEXT PRIMARY KEY,
  processo_id TEXT NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  rascunho INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS tarefas (
  id TEXT PRIMARY KEY,
  processo_id TEXT NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  responsavel TEXT NOT NULL DEFAULT '',
  vencimento TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberta',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'queued',
  created_by TEXT NOT NULL DEFAULT 'portal',
  result_url TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS noticias (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  link TEXT NOT NULL,
  resumo TEXT NOT NULL DEFAULT '',
  area TEXT NOT NULL DEFAULT 'geral',
  fonte TEXT NOT NULL DEFAULT '',
  publicado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_noticias_area ON noticias(area, publicado_em);
