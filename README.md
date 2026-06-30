<div align="center">
  <h1>💬 WhatFlow</h1>
  <p><strong>Plataforma SaaS de automação WhatsApp — chatbot visual + IA + campanhas em massa</strong></p>
  <p>
    <img src="https://img.shields.io/badge/Node.js-20_LTS-339933?logo=nodedotjs&logoColor=white">
    <img src="https://img.shields.io/badge/Angular-17-DD0031?logo=angular&logoColor=white">
    <img src="https://img.shields.io/badge/Supabase-PostgreSQL_15-3ECF8E?logo=supabase&logoColor=white">
    <img src="https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript&logoColor=white">
    <img src="https://img.shields.io/badge/Evolution_API-v2-25D366?logo=whatsapp&logoColor=white">
    <img src="https://img.shields.io/badge/IA-Groq_Free-F55036?logoColor=white">
  </p>
</div>

---

## 🚀 Início rápido (5 min)

### Pré-requisitos
- **Node.js 20+** — `nvm use` (`.nvmrc` já configurado)
- **Docker + Docker Compose**
- **Conta Supabase** → https://supabase.com (gratuito)
- **Evolution API v2** rodando → https://github.com/EvolutionAPI/evolution-api
- **Conta Groq** (IA gratuita) → https://console.groq.com

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Edite o .env com suas credenciais

# 3. Subir Redis
docker compose up -d redis

# 4. Aplicar migrations no Supabase
npm run prisma:deploy

# 5. Iniciar tudo
npm run dev
```

| Serviço | URL |
|---------|-----|
| 🔵 API REST | http://localhost:3000/v1/health |
| 🟢 Frontend Angular | http://localhost:4200 |
| 📊 Bull Board (filas) | http://localhost:3001 |
| 🗃️ Prisma Studio | `npm run prisma:studio` |

---

## 📁 Estrutura completa

```
whatflow/
│
├── 🤖 .claude/                    ← Claude Code — comandos e skills
│   ├── settings.json              ← Permissões de ferramentas
│   ├── commands/
│   │   ├── executar_inicio.md     ← /executar_inicio — setup guiado 5 passos
│   │   ├── implementar.md         ← /implementar T-XXX — gera código da tarefa
│   │   ├── status_sprint.md       ← /status_sprint — progresso real do sprint
│   │   └── testar.md              ← /testar — roda testes + cobertura
│   └── skills/
│       ├── executar-inicio/       ← Skill detalhada do setup inicial
│       └── contexto-projeto/      ← Skill de contexto geral do projeto
│
├── 🧩 docs/                       ← Toda a documentação do projeto
│   ├── WhatFlow_PRD_v1.0.docx     ← Requisitos, módulos, planos SaaS
│   ├── WhatFlow_TASKS_v1.0.docx   ← 52 tarefas em 6 sprints (12 semanas)
│   ├── WhatFlow_openapi.yaml      ← API Contract — import no Insomnia/Postman
│   ├── WhatFlow_Wireframes.html   ← UI mockada — abrir no navegador
│   ├── WhatFlow_schema.prisma     ← Schema de referência
│   ├── WhatFlow_supabase_rls.sql  ← Executar no SQL Editor do Supabase
│   └── plugin/
│       └── whatflow-dev.plugin    ← Instalar no Claude Code/Cowork
│
├── ⚙️ .vscode/                    ← Configurações do VSCode
│   ├── settings.json              ← Format on save, file nesting, TS
│   ├── extensions.json            ← Extensões recomendadas (aceitar ao abrir)
│   ├── launch.json                ← Debug API (F5) + Jest
│   └── tasks.json                 ← Ctrl+Shift+B: Dev, Docker, Prisma, Tests
│
├── 📄 CLAUDE.md                   ← Contexto completo do projeto para IA
├── 📄 .env.example                ← Template de variáveis (copie para .env)
├── 📄 .nvmrc                      ← Node 20
├── 📄 .prettierrc                 ← Formatação padrão
├── 🐳 docker-compose.yml          ← api + web + redis + bull-board
├── 🐳 docker-compose.prod.yml     ← Produção
│
├── 🔵 apps/api/                   ← Backend Node.js + Express + TypeScript
│   ├── src/
│   │   ├── app.ts + server.ts     ← Express + Socket.io + graceful shutdown
│   │   ├── core/                  ← config (Zod), logger (Pino), prisma, redis, errors
│   │   ├── modules/ (14)          ← auth, tenants, users, instances, flows,
│   │   │                             flow-engine, contacts, conversations, messages,
│   │   │                             campaigns, ai, webhooks, analytics, webhook-receiver
│   │   ├── integrations/
│   │   │   ├── evolution-api/     ← client, service, types
│   │   │   └── ai/                ← groq.adapter, ollama.adapter, interface
│   │   ├── queues/                ← BullMQ: campaign.worker, webhook.worker
│   │   └── middlewares/           ← auth (JWT), validate (Zod), rate-limit, error-handler
│   ├── prisma/
│   │   └── schema.prisma          ← 14 models, 19 enums, índices, relações
│   └── tests/                     ← Jest: unit/, integration/, fixtures/
│
└── 🟢 apps/web/                   ← Frontend Angular 17 Standalone
    └── src/app/
        ├── app.component.ts       ← Shell com sidebar
        ├── app.routes.ts          ← Lazy loading dos 8 módulos
        ├── core/
        │   ├── services/          ← AuthService (signals), ApiService
        │   ├── guards/            ← authGuard, roleGuard
        │   └── interceptors/      ← auth (Bearer), error (401→logout)
        ├── shared/
        │   ├── components/ (9)    ← SidebarNav, TopBar, Avatar, TagBadge...
        │   ├── pipes/ (3)         ← date, truncate, phone
        │   └── directives/ (2)    ← clickOutside, autoResize
        └── modules/ (8)
            ├── dashboard/         ← KPIs + gráficos
            ├── inbox/             ← Caixa de entrada realtime (8 components)
            ├── flows/             ← Flow Builder visual (13 components)
            ├── campaigns/         ← Disparos em massa (5 components)
            ├── contacts/          ← Contatos + CSV import
            ├── instances/         ← QR Code + status WhatsApp
            ├── analytics/         ← Relatórios e métricas
            └── settings/          ← IA, webhooks, usuários, tenant
```

---

## 🤖 Claude Code — comandos disponíveis

Abra o projeto no Claude Code (`claude .`) e use:

| Comando | O que faz |
|---------|-----------|
| `/executar_inicio` | Setup guiado 5 passos: wireframes → Supabase → Prisma → RLS → Sprint 1 |
| `/implementar T-005` | Gera código completo da tarefa T-005 (ou qualquer T-XXX) |
| `/status_sprint` | Analisa arquivos e mostra progresso real do sprint atual |
| `/testar` | Roda todos os testes e exibe cobertura |
| `/testar api` | Só testes do backend com relatório de cobertura |

O arquivo `CLAUDE.md` na raiz é lido automaticamente pelo Claude Code e contém toda a arquitetura, convenções, ADRs e sprint atual.

Para instalar o plugin no Claude Code/Cowork: `docs/plugin/whatflow-dev.plugin`

---

## 📋 Scripts NPM

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | API + Web em modo dev (hot-reload) |
| `npm run build` | Build produção (todos os workspaces) |
| `npm run test` | Todos os testes |
| `npm run lint` | Lint em todos os workspaces |
| `npm run prisma:migrate` | Cria migrations em ambiente dev |
| `npm run prisma:deploy` | Aplica migrations existentes no Supabase/produção |
| `npm run prisma:generate` | Regenera Prisma Client |
| `npm run prisma:studio` | Interface visual do banco |
| `docker compose up -d` | Sobe todos os serviços |

---

## 🗄️ Migrations Prisma + Supabase

O fluxo adotado para o Supabase é **baseline + `prisma migrate deploy`**. Use `npm run prisma:deploy` para aplicar migrations já versionadas em bancos compartilhados, staging e produção; esse comando é não interativo e funciona melhor com o pooler do Supabase.

Use `npm run prisma:migrate -- --name nome_da_migration` apenas para criar uma nova migration em ambiente de desenvolvimento controlado. Depois de revisar e commitar a pasta gerada em `apps/api/prisma/migrations`, os demais ambientes devem receber a mudança com `npm run prisma:deploy`.

Evite `prisma migrate reset` contra bancos Supabase compartilhados. Para conferir o schema sem alterar dados, use `npm run prisma:studio` ou rode queries de leitura diretamente no Supabase.

---

## 🗂️ Sprints

| Sprint | Semanas | Épico |
|--------|---------|-------|
| **Sprint 1** ← atual | 1-2 | Foundation: infra, auth, Angular base |
| Sprint 2 | 3-4 | Evolution API, QR Code, WebSocket |
| Sprint 3 | 5-6 | Flow Builder (visual + engine) |
| Sprint 4 | 7-8 | IA Groq/Ollama + Campanhas BullMQ |
| Sprint 5 | 9-10 | Inbox realtime + Contatos |
| Sprint 6 | 11-12 | Analytics, webhooks, testes, deploy |

Detalhes completos: `docs/WhatFlow_TASKS_v1.0.docx`
