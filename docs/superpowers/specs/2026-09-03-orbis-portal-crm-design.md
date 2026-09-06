# Orbis — Portal + CRM mínimo (sub-projeto 1) — Design

Data: 2026-09-03
Status: aprovado para planejamento
Decisões: abordagem A (híbrida com fila), portal-first, Cloudflare

## Contexto
Escritório de advocacia (pequeno/médio porte). Hoje: Notion + docs + WhatsApp + planilhas + consulta manual PJe/e-SAJ. Desorganizado.
Objetivo do case: medir antes/depois em (1) acompanhamento processual (prazos perdidos, tempo de consulta) e (2) documentos/petições (tempo por peça).

## Escopo do sub-projeto 1 (2 semanas)
Portal web/mobile com CRM mínimo jurídico. NÃO inclui: financeiro completo, adapter Hermes (sub-projeto 3), automação PJe via computer-use.

Entidades:
- Cliente (nome, contato, honorário/status básico)
- Processo (número CNJ, tribunal, fase, responsável, etiquetas de área)
- Movimentação (data, texto, lida/não-lida, origem: manual no v1)
- Prazo (data, tipo, status: aberto/cumprido/perdido)
- Documento (título, link R2, rascunho vs final, processo vinculado)
- Tarefa (título, responsável, vencimento, status)

Telas:
1. Dashboard — prazos próximos (7 dias), movimentações não lidas, processos com risco
2. Processos — lista com busca por número/nome, filtro por status
3. Ficha do processo — timeline (movimentações + prazos + docs), botão "Pedir minuta" (placeholder desabilitado, vende a visão do Hermes)
4. Clientes — lista + ficha simples
5. Notícias (base do sub-projeto 2) — painel com feed curado: mudanças na lei, Jusbrasil, jurisprudência; filtro por área; v1 = links + resumo manual/IA simples, sem crawler complexo

## Arquitetura (Cloudflare)
- Frontend: Workers (static / SSR leve) — mobile-first, acesso pelo celular
- Backend: Workers + Hono (ou similar) — API REST/JSON
- Banco: D1 (SQLite gerenciado) — suficiente para 1 escritório, custo zero inicial
- Arquivos: R2 — PDFs, minutas, docs
- Auth: Access ou login simples com sessão (v1: usuário único do escritório + 1 admin; multi-usuário depois)
- Jobs (preparação p/ sub-projeto 3): tabela `jobs` no D1 (id, tipo, payload, status: queued/running/done/error, created_by, result_url). Portal cria job; worker Hermes no PC puxa via polling HTTPS outbound (funciona atrás de NAT, sem abrir porta). Nesse sub-projeto, jobs ficam em queued/done manual.

## Fluxo de dados (v1, sem Hermes)
Cadastro manual / import CSV de processos → movimentações lançadas manualmente → prazos gerados → dashboard reflete risco. Notícias: ingestão manual/curada de links + resumo → painel filtrável.

Métricas do case (antes/depois, coletar na 1ª semana):
- nº prazos perdidos/mês, tempo médio de consulta processual, tempo médio por peça, nº movimentações não vistas >24h

## Fora do escopo (YAGNI)
Financeiro completo, multi-escritório, permissões finas, crawler jurisprudencial automático, computer-use PJe, SLA de tempo real.

## Riscos
- Computer-use no PJe fica para depois; v1 não promete automação de consulta (evita vender o frágil como pronto).
- LGPD/OAB: dados sensíveis em D1/R2 — ativar criptografia padrão, controle de acesso, trilha de auditoria mínima (quem viu/editou processo).
- PC sempre online é premissa do sub-projeto 3, não deste.

## Próximo passo
Plano de implementação do sub-projeto 1 em Workers/D1/R2, com seed de demonstração para impacto visual.
