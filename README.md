<div align="center">
  <h1>💬 WhatFlow</h1>
  <p><strong>Plataforma SaaS multi-tenant de automação para WhatsApp — chatbot visual + IA generativa + campanhas em massa + inbox unificada</strong></p>
  <p>
    <img src="https://img.shields.io/badge/Node.js-20_LTS-339933?logo=nodedotjs&logoColor=white">
    <img src="https://img.shields.io/badge/Angular-17-DD0031?logo=angular&logoColor=white">
    <img src="https://img.shields.io/badge/Supabase-PostgreSQL_15-3ECF8E?logo=supabase&logoColor=white">
    <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white">
    <img src="https://img.shields.io/badge/Evolution_API-v2-25D366?logo=whatsapp&logoColor=white">
    <img src="https://img.shields.io/badge/IA-Groq_Free-F55036?logoColor=white">
  </p>
</div>

---

## O que é o WhatFlow

WhatFlow é uma plataforma SaaS **multi-tenant** para automação de WhatsApp. Permite:

- **Flow Builder visual** — chatbots por arrastar-e-soltar, com motor de execução (nós, sessões, variáveis).
- **IA generativa gratuita** — respostas via Groq (`llama-3.3-70b-versatile`) ou Ollama local.
- **Campanhas em massa** — disparos agendados com filas assíncronas (BullMQ + Redis), retry e pausa/retomada.
- **Inbox unificada realtime** — atendimento humano, atribuição, bot on/off, via Socket.io.
- **Isolamento por tenant** — Row Level Security (RLS) no Supabase; o `tenant_id` vem do JWT.

Conexão com o WhatsApp via **Evolution API v2** (self-hosted, sem custo por mensagem).

---

## Stack e arquitetura

| Camada | Tecnologia |
|--------|-----------|
| Backend API | Node.js 20 + Express 5 + TypeScript (ESM, rodado via `tsx`) |
| Frontend SPA | Angular 17 (Standalone Components) + Angular Material |
| Banco / Auth | Supabase (PostgreSQL 15, Auth, Realtime, Storage) |
| ORM | Prisma (migrations + queries type-safe) |
| WhatsApp | Evolution API v2 |
| IA | Groq (padrão) · Ollama (alternativa local) |
| Filas | BullMQ + Redis |
| Realtime | Socket.io |
| Testes | Jest (API, ≥70%) · Jasmine + Cypress (Web, ≥60%) |
| API Docs | OpenAPI 3.1 + Swagger UI (`/docs`) |

**Monorepo** (npm workspaces):

```
whatflow/
├── apps/
│   ├── api/                  # Backend Node.js + Express + TypeScript
│   │   ├── src/
│   │   │   ├── app.ts        # Express: middlewares, Swagger, rotas, Socket.io
│   │   │   ├── server.ts     # HTTP listen + BullMQ workers + graceful shutdown
│   │   │   ├── core/         # config (Zod), logger (Pino), prisma, redis, swagger, errors
│   │   │   ├── modules/      # 1 pasta por domínio (auth, instances, flows, campaigns, ...)
│   │   │   │                 #   controller / service / repository / schema (Zod) / routes
│   │   │   ├── integrations/ # EvolutionApiService, AiService (Groq/Ollama)
│   │   │   ├── queues/       # BullMQ workers e processors
│   │   │   └── middlewares/  # auth (JWT), rate-limit, error-handler, request-id
│   │   ├── prisma/           # schema.prisma + migrations + seed
│   │   └── tests/            # Jest
│   └── web/                  # Frontend Angular 17 (SPA)
│       └── src/app/
│           ├── core/         # AuthService, ApiService, guards, interceptors
│           ├── shared/       # componentes/pipes/directives compartilhados
│           └── modules/      # lazy-loaded: dashboard, inbox, flows, campaigns,
│                             #   contacts, instances, analytics, settings
├── docs/                     # OpenAPI, PRD, TASKS, RLS, wireframes, DEPLOY
├── docker-compose.yml        # dev: api + web + redis + bull-board + evolution
├── docker-compose.prod.yml   # produção (ver docs/DEPLOY.md)
├── .env.example
└── CLAUDE.md                 # contexto completo do projeto (arquitetura, ADRs, convenções)
```

**Camadas do backend** (regra dura): `controller` (valida com Zod, chama service) → `service` (regra de negócio) → `repository` (única camada que toca o Prisma). Erros usam `AppError` (`statusCode` + `code`).

---

## Setup em menos de 30 minutos

### Pré-requisitos

- **Node.js 20 LTS** — há um `.nvmrc`; use `nvm use`.
- **Docker + Docker Compose** (caminho rápido; traz Redis + Evolution API locais).
- **Conta Supabase** (gratuita) → https://supabase.com — para o banco/Auth.
- **Conta Groq** (gratuita, opcional para IA) → https://console.groq.com.

### 1. Clonar e instalar

```bash
git clone <repo-url> whatflow && cd whatflow
npm install                      # instala os dois workspaces (raiz gerencia tudo)
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Edite o `.env`. As chaves **essenciais** para subir a API:

| Grupo | Chaves | Onde obter |
|-------|--------|-----------|
| **Supabase** (obrigatório) | `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` | Supabase → Project Settings → Database (connection string) e API (keys / JWT secret) |
| **Evolution API** | `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` | Se usar o Docker Compose, já vêm sobrescritas para a Evolution local (`whatflow-local-dev`). |
| **IA (Groq)** | `GROQ_API_KEY` | https://console.groq.com/keys — opcional; sem ela o app sobe, só a IA não responde. |
| **Criptografia** | `AI_ENCRYPTION_KEY` | String de **exatamente 32 caracteres** (AES-256 das chaves de IA no banco). |
| **App** | `PORT` (3000), `API_PREFIX` (`/v1`), `JWT_SECRET`, `CORS_ORIGINS` (`http://localhost:4200`) | — |

> **Nota sobre `DATABASE_URL` (pooler):** o Supabase moderno resolve `db.<ref>.supabase.co` só por **IPv6**. Se sua rede/host não tem IPv6 (comum no Windows/WSL/CI), as migrations e o Prisma falham com timeout. Use a string do **connection pooler** do Supabase (host `aws-0-<region>.pooler.supabase.com`, porta `6543`, que é **IPv4**). Mantenha `DIRECT_URL` apontando para a conexão direta (porta `5432`) quando precisar criar migrations. Ver [Troubleshooting](#troubleshooting).

### 3a. Caminho rápido — Docker Compose (recomendado)

Sobe API (`:3000`), Web (`:4200`), Redis, Bull-Board (`:3001`) e uma Evolution API local (`:8080`) com hot-reload:

```bash
docker compose up          # ou: docker compose up -d  (segundo plano)
```

As migrations do Prisma **não** rodam sozinhas no dev via compose — aplique-as uma vez (passo 4).

### 3b. Alternativa — rodar local (sem Docker para a app)

Precisa de um Redis acessível (`docker compose up -d redis` resolve). Depois:

```bash
npm run dev                # sobe API (tsx watch) + Web (ng serve) juntos (concurrently)
```

Ou individualmente:

```bash
npm run dev   --workspace=apps/api    # só a API, com hot-reload
npm run start --workspace=apps/web    # só o Angular (ng serve)
```

### 4. Migrations do banco (Prisma → Supabase)

Aplique as migrations já versionadas (não interativo, ideal para o pooler):

```bash
npm run prisma:deploy --workspace=apps/api
# equivalente pela raiz: npm run prisma:deploy
```

> Só crie migrations novas com `npm run prisma:migrate -- --name <nome>` (usa `DIRECT_URL`). **Nunca** rode `prisma migrate reset` contra um Supabase compartilhado. Ver a seção [Migrations](#migrations-prisma--supabase).

Para inspecionar o banco visualmente: `npm run prisma:studio`.
Seed (opcional): `npm run prisma:seed --workspace=apps/api` (o `prisma/seed/index.ts` é o ponto de entrada).

### 5. Abrir

| Serviço | URL |
|---------|-----|
| Frontend Angular | http://localhost:4200 |
| API — health check | http://localhost:3000/health |
| API — base REST | http://localhost:3000/v1 |
| **Swagger UI (API docs)** | **http://localhost:3000/docs** |
| OpenAPI JSON | http://localhost:3000/v1/openapi.json |
| Bull-Board (filas) | http://localhost:3001 |
| Evolution API (local) | http://localhost:8080 |

Crie um usuário via fluxo de registro do frontend (ou `POST /v1/auth/register`) e faça login. Pronto — você está rodando.

---

## Documentação da API (Swagger)

A API serve a especificação **OpenAPI 3.1** (`docs/WhatFlow_openapi.yaml`) em runtime:

- **Swagger UI interativo:** http://localhost:3000/docs
- **Spec em JSON:** http://localhost:3000/v1/openapi.json

Se o arquivo YAML não estiver disponível no ambiente (ex.: container que não copiou `docs/`), a API sobe normalmente e essas rotas respondem `404` com mensagem amigável. Você pode apontar para outro arquivo com a env `OPENAPI_SPEC_PATH`.

Alternativa: importe `docs/WhatFlow_openapi.yaml` no Insomnia/Postman.

---

## Scripts

Pela raiz (aplicam a todos os workspaces com `--if-present`):

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | API + Web em modo dev (hot-reload, via `concurrently`) |
| `npm run build` | Build de todos os workspaces |
| `npm run lint` | Lint de todos os workspaces |
| `npm run test` | Testes de todos os workspaces |
| `npm run test:e2e` | Cypress (Web) |
| `npm run prisma:deploy` | Aplica migrations existentes (produção/compartilhado) |
| `npm run prisma:migrate` | Cria uma migration nova (dev) |
| `npm run prisma:generate` | Regenera o Prisma Client |
| `npm run prisma:studio` | UI visual do banco |

Backend (`--workspace=apps/api`):

| Comando | Descrição |
|---------|-----------|
| `dev` | `tsx watch src/server.ts` |
| `build` | `tsc -p tsconfig.json` (type-check / gate de build) |
| `start` | `node dist/server.js` |
| `lint` | `eslint src --ext .ts` |
| `test` | `jest --passWithNoTests` |
| `test:coverage` | `jest --coverage` (meta ≥70%) |
| `prisma:seed` | `tsx prisma/seed/index.ts` |
| `rls:smoke` | valida isolamento por RLS (`scripts/rls-smoke.ts`) |

Frontend (`--workspace=apps/web`):

| Comando | Descrição |
|---------|-----------|
| `start` | `ng serve` (porta 4200) |
| `build` / `build:prod` | `ng build` / `ng build --configuration production` |
| `lint` | `ng lint` |
| `test` | `ng test --watch=false --code-coverage` (meta ≥60%) |
| `e2e` / `e2e:open` | Cypress headless / interativo |

---

## Migrations (Prisma + Supabase)

Fluxo adotado: **baseline + `prisma migrate deploy`**.

- **Aplicar** migrations versionadas (staging, produção, banco compartilhado): `npm run prisma:deploy`. É não interativo e funciona bem com o pooler do Supabase.
- **Criar** uma migration nova (apenas dev controlado): `npm run prisma:migrate -- --name <nome>`. Revise e commite a pasta gerada em `apps/api/prisma/migrations`, e os demais ambientes aplicam com `deploy`.
- **Evite** `prisma migrate reset` contra Supabase compartilhado.

Em produção, a API roda `prisma migrate deploy` automaticamente no start (ver `Dockerfile.prod` e `docs/DEPLOY.md`).

---

## Troubleshooting (gotchas conhecidos)

- **Prisma/migrations dão timeout (`P1001`) contra o Supabase** — normalmente é IPv6. O host `db.<ref>.supabase.co` só resolve por IPv6; use a **connection string do pooler** (host `...pooler.supabase.com`, porta `6543`, IPv4) na `DATABASE_URL`. Mantenha `DIRECT_URL` para operações que exigem conexão direta.
- **Evolution API não gera QR Code (statusReason 405)** — o Baileys anuncia uma versão desatualizada do WhatsApp Web e é recusado. Fixe `CONFIG_SESSION_PHONE_VERSION` (já configurado no `docker-compose.yml`; atualize periodicamente conforme `wppconnect-team/wa-version`).
- **Evolution retorna `{exists:false}` ao responder remetentes `@lid`** — use Evolution **v2.3.7+** (o compose já usa `evoapicloud/evolution-api:v2.3.7`); a v2.1.1 falhava com jids `@lid`.
- **Hot-reload não dispara no Docker/Windows** — o filesystem montado nem sempre emite eventos inotify. O compose já força `CHOKIDAR_USEPOLLING=true`/`WATCHPACK_POLLING=true`; em último caso, `docker compose restart api`.
- **Redis `ECONNREFUSED ::1:6379` nos testes/dev** — não há Redis rodando; suba `docker compose up -d redis`. Nos testes é apenas ruído dos workers (não falham por isso).
- **`AI_ENCRYPTION_KEY must contain at least 32 character(s)`** no boot — a chave precisa ter exatamente/ao menos 32 caracteres.
- **CORS bloqueando o frontend** — confirme que `CORS_ORIGINS` inclui `http://localhost:4200`.

---

## Convenções

- **Branches:** `feat/T-001-monorepo-setup`, `fix/T-015-webhook-receiver`.
- **Commits:** `feat(auth): implement JWT middleware #T-005`.
- **PRs:** obrigatório passar o CI antes de merge.
- **Backend:** Zod em todo input; logs com contexto `{ tenantId, userId, action }`; sempre `async/await`.
- **Frontend:** Standalone Components; `inject()` (sem constructor injection); HTTP sempre via `ApiService`; Reactive Forms; lazy loading + `AuthGuard` nas rotas.

Contexto completo (arquitetura, modelo de dados, ADRs, integrações): **[`CLAUDE.md`](./CLAUDE.md)**.

---

## Documentação e links

| Documento | Conteúdo |
|-----------|----------|
| [`CLAUDE.md`](./CLAUDE.md) | Visão geral, stack, estrutura, módulos, ADRs, convenções |
| [`docs/WhatFlow_openapi.yaml`](./docs/WhatFlow_openapi.yaml) | Contrato OpenAPI 3.1 (também em `/docs` via Swagger) |
| [`docs/DEPLOY.md`](./docs/DEPLOY.md) | **Deploy em produção** (VPS Ubuntu + Docker + nginx + Cloudflare) |
| [`docs/WhatFlow_PRD_v1.0.docx`](./docs/WhatFlow_PRD_v1.0.docx) | Product Requirements Document |
| [`TASKS.md`](./TASKS.md) / [`docs/WhatFlow_TASKS_v1.0.docx`](./docs/WhatFlow_TASKS_v1.0.docx) | 52 tarefas em 6 sprints |
| [`PENDENCIA.MD`](./PENDENCIA.MD) | Pendências e segredos a rotacionar |
| [`docs/WhatFlow_supabase_rls.sql`](./docs/WhatFlow_supabase_rls.sql) | Políticas RLS + views analytics |
| [`docs/WhatFlow_Wireframes.html`](./docs/WhatFlow_Wireframes.html) | Wireframes (abrir no navegador) |

### Claude Code

O `CLAUDE.md` é lido automaticamente pelo Claude Code. Comandos disponíveis: `/executar_inicio`, `/implementar T-XXX`, `/status_sprint`, `/testar [api|web]`. Plugin: `docs/plugin/whatflow-dev.plugin`.

---

Para **produção**, siga o guia completo em **[`docs/DEPLOY.md`](./docs/DEPLOY.md)**.
