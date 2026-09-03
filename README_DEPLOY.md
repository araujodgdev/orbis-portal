# Deploy Orbis v1 (Cloudflare)

1. `npm install`
2. `npx wrangler d1 create orbis_db` → copiar `database_id` para `wrangler.jsonc`
3. `npx wrangler r2 bucket create orbis-docs`
4. `npm run db:migrate` (local) e `npx wrangler d1 migrations apply orbis_db --remote` (prod)
5. Seed demo só em dev/demo (banco local — nunca prod): `npm run db:migrate && npm run db:seed` (executa `scripts/seed-demo.sql` via `wrangler d1 execute orbis_db --local`). Rode uma única vez por banco local; os ids `demo_*` são fixos e uma segunda execução falha em PRIMARY KEY de propósito.
6. `npm run deploy` → URL `https://orbis-portal.<sua-conta>.workers.dev`
7. Criar users iniciais direto no D1 prod (email + hash de `hashPass`) e testar `/api/health`, login, dashboard
8. Nunca rodar seed demo no banco com dados reais do escritório
