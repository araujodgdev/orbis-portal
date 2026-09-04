# Orbis — Portal + CRM Mínimo para Escritório de Advocacia

O **Orbis** é um portal e sistema CRM mínimo desenvolvido para gestão de escritórios de advocacia, centralizando o acompanhamento de clientes, processos jurídicos, movimentações, prazos, documentos e notícias.

## 🏗️ Arquitetura

O projeto é executado de forma unificada na infraestrutura da Cloudflare:
- **Backend API**: [Hono](https://hono.dev/) rodando em um Cloudflare Worker.
- **Frontend SPA**: React 19 + Vite + Tailwind CSS v4, servido diretamente pelo Worker via binding estático (`ASSETS`).
- **Banco de Dados**: Cloudflare D1 (SQLite relacional).
- **Armazenamento de Arquivos**: Cloudflare R2 (`orbis-docs`).

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- Node.js (versão 18 ou superior)
- npm

### 1. Instalação das Dependências
```bash
npm install
cd frontend && npm install && cd ..
```

### 2. Banco de Dados Local (D1 Migration & Seed)
```bash
# Aplica as migrações SQL no banco local D1
npm run db:migrate

# Popula o banco local com dados de demonstração (executar apenas 1 vez)
npm run db:seed
```

### 3. Servidor de Desenvolvimento
```bash
npm run dev
```
O aplicativo estará disponível em: `http://localhost:8787`

---

## 🧪 Testes

### Testes do Backend
```bash
npm test
```

### Testes do Frontend
```bash
cd frontend && npm test
```

---

## 👥 Colaboração e Contribuição

Para colaborar com o desenvolvimento do Orbis Portal:
1. Veja a lista de colaboradores em [`CONTRIBUTORS.md`](./CONTRIBUTORS.md).
2. Para deploy em produção, siga o checklist em [`README_DEPLOY.md`](./README_DEPLOY.md).
3. Abra uma issue ou solicite alterações através de Pull Requests!
