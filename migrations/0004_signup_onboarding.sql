ALTER TABLE users ADD COLUMN onboarding_done INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS escritorios (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  areas TEXT NOT NULL DEFAULT '[]',
  tamanho_equipe TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
