# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Orbis — portal + CRM mínimo para escritório de advocacia. Um único Cloudflare Worker serve a API (Hono) e o SPA (assets estáticos). Banco D1 (SQLite), arquivos R2. Product spec: `docs/superpowers/specs/2026-09-03-orbis-portal-crm-design.md`.

## Commands

Root (`/`, backend + worker):
- `npm run dev` — `wrangler dev` (API + SPA local, `http://localhost:8787`)
- `npm test` — `vitest run` (toda a suíte backend)
- `npx vitest run tests/<name>.test.ts` — um único arquivo de teste backend
- `npm run db:migrate` — aplica `migrations/` no D1 local
- `npm run db:seed` — `scripts/seed-demo.sql` no D1 local (rodar 1x; ids `demo_*` fixos falham em re-execução de propósito; nunca em prod)
- `npm run deploy` — `wrangler deploy` → `https://orbis-portal.<conta>.workers.dev`

Frontend (`frontend/`):
- `npm run dev` — Vite dev server
- `npm run build` — `vite build` → `frontend/dist/` (é o que o Worker serve via binding `ASSETS`)
- `npm test` — `vitest run`; arquivo único: `npx vitest run src/<name>.test.tsx`

Deploy checklist completo (criar D1/R2, migrar `--remote`, criar users prod): `README_DEPLOY.md`.

## Architecture

- `src/index.ts` — app Hono. Monta rotas `/api/*`, handlers `/api/login|logout`, `app.notFound` (JSON 404 para `/api/*`, senão serve `/index.html` via `ASSETS` = SPA fallback), `app.onError`. `wrangler.jsonc`: `DB` (D1 `orbis_db`, `migrations_dir`), `DOCS` (R2 `orbis-docs`), `ASSETS` (`./frontend/dist`, `not_found_handling: single-page-application`), var `ALLOWED_ORIGIN`.
- Auth (`src/lib/auth.ts`): sessão por cookie `orbis_session`. `requireAuth` cobre `/api/*` exceto `/api/health` e `/api/login`; sem cookie/sessão válida ou sem `DB` → 401 `{ error: 'unauthorized', ... }`. `hashPass` = SHA-256 de `orbis:{pass}`; sessões duram 12h; `Secure` só sob https. `audit()` grava `audit_logs`.
- Rotas (`src/routes/*.ts`): `clientes, processos, movimentacoes, prazos, dashboard, documentos, tarefas, jobs, noticias, csv` — cada arquivo um sub-app Hono montado em `index.ts` (`documentos` montado 2x: `/api/documentos` e `/api/processos-docs`). Padrão: `zod schema.parse` no POST, D1 via `c.env.DB.prepare(...).bind(...)`, ids `prefixo_random` (`cli_`, `pro_`, `ses_`, `aud_`…).
- Erros (`src/lib/errors.ts`): `err(e, code, status)` / `reqId()`; forma `{ error, code, requestId }`. Convenção: falha de validação Zod → 400 `invalid_*`; falha de DB em input válido → 500; `/api/*` desconhecido → 404 JSON.
- Validação (`src/lib/validate.ts`): `isCNJ` (formato `0000000-00.0000.0.00.0000`), `isDateYYYYMMDD` (calendário real).
- DB: `migrations/0001_init.sql` (clientes, processos, movimentacoes, prazos, documentos, tarefas, jobs, noticias, users, sessions) + `0002_audit.sql` (audit_logs). Seed demo só local: `scripts/seed-demo.sql` (+ helper `src/seed.ts`).
- Frontend (`frontend/src/`): React 19 + Vite + Tailwind v4. Sem react-router — `App.tsx` escolhe página por `window.location.pathname` (`/login`, `/processos`, `/processos/:id` → `FichaProcesso`, `/clientes`, `/noticias`, resto → `Dashboard`). Páginas em `src/pages/`. Layout: sidebar fixa no desktop (`lg:`), tab bar inferior no mobile; tokens `bg-paper/text-ink/bg-brand/border-line`.
- Testes backend (`tests/`): chamam `app.request()` direto, sem servidor/DB vivo — request sem sessão espera 401; cookie fake sem linha em `sessions` também é 401. `post_errors.test.ts` injeta `fakeDb` para provar mapeamento 5xx. Frontend: `Dashboard.test.tsx` (jsdom).
