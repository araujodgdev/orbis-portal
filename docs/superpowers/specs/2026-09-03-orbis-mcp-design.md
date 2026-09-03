# Orbis MCP — Design (2026-09-03)

Servidor MCP dentro do Worker `orbis-portal`, expondo o CRM como tools
para agentes externos. Decisões aprovadas: morar no portal, auth por
token Bearer, escopo CRUD v1.

## Transporte

- `POST /mcp`: Streamable HTTP via `@modelcontextprotocol/sdk`, modo
  stateless (sem `Mcp-Session-Id`, sem Durable Object).
- `GET /mcp` → 405. Sem SSE (legado).
- Nomes de tools com no máximo 64 caracteres.

## Auth e tokens

- Migration `0006_api_tokens.sql`: `api_tokens(id, user_id, nome,
  token_hash, created_at, revogado_em)`.
- Formato do token: `orbis_` + 32 chars aleatórios; guardado só o
  SHA-256 (mesmo padrão do `hashPass`).
- MCP aceita **só** `Authorization: Bearer`; cookie `orbis_session`
  nunca autentica `/mcp` (401 sem Bearer válido ou revogado).
- Gerência com sessão web: `POST /api/tokens` (cria, retorna o valor
  em claro **uma única vez**), `GET /api/tokens` (lista mascarada),
  `DELETE /api/tokens/:id` (revoga = seta `revogado_em`).

## Tools v1 (16)

Processos: `search_processos` (q, status, fase), `get_processo` (ficha
completa), `create_processo`, `update_processo` (fase, status,
responsável, área, tribunal).
Clientes: `search_clientes` (nome, cpf, cnpj), `get_cliente` (ficha +
processos), `create_cliente`, `update_cliente`, `delete_cliente`
(409 quando há processos vinculados).
Prazos: `list_prazos` (status, processo_id), `create_prazo`,
`update_prazo_status`.
Tarefas: `list_tarefas`, `create_tarefa`, `update_tarefa`
(inclui concluir).
Dashboard: `get_dashboard` (resumo).

Todas reutilizam os schemas zod das rotas — nenhuma regra de
validação duplicada. Sem `delete_processo` (arquivar via
`update_processo`, mesma razão da API: filhos em cascata + R2).

## Auditoria e erros

- Cada `tools/call` grava `audit()` com `actor=user_id do token`,
  `acao=mcp.<tool>`, `meta_json={tool, argumentos}`.
- Erro de tool retorna mensagem legível em PT-BR (ex.: "CNJ inválido.
  Use NNNNNNN-DD.AAAA.J.TR.OOOO"), nunca stack trace.
- JSON-RPC malformado → erro `-32700`; tool inexistente → `-32601`.

## Testes

- TDD: token fake no D1 fake; `POST /mcp` com `tools/list`
  (espera as 16) e `tools/call` por grupo (leitura, escrita,
  401 sem token, 409 no delete com filhos); asserts em `audit_logs`.
- Validação manual com MCP Inspector antes do deploy.

## Deploy e rollout

- Junto no Worker staging existente (`/mcp` no mesmo deploy),
  sem binding novo. Migration `0006` no D1 staging via
  `migrations apply --remote --env staging`.
- Smoke pós-deploy: `tools/list` + 1 `tools/call` de leitura com
  token real de staging.
- Fora do escopo v1: OAuth, SSE, Durable Object, tools de notícias,
  documentos (upload binário) e jobs.
