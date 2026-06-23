# WhatFlow — Contexto do Projeto para Claude Code

## O que é este projeto

**WhatFlow** é uma plataforma SaaS multi-tenant de automação para WhatsApp.
Inspirado no SMBot (smbot.com.br), permite criar chatbots visuais, disparar campanhas
em massa, integrar IA generativa gratuita e gerenciar atendimento humano via inbox unificada.

---

## Stack Tecnológico (decisões fechadas — não alterar sem discussão)

| Camada | Tecnologia | Versão / Detalhe |
|--------|-----------|-----------------|
| Backend API | Node.js + Express + TypeScript | Node 20 LTS, Express 5 |
| Frontend SPA | Angular + Angular Material | Angular 17+ Standalone Components |
| Banco de dados | Supabase (PostgreSQL) | PostgreSQL 15, Auth, Realtime, Storage |
| WhatsApp Gateway | Evolution API | v2, self-hosted |
| IA principal | Groq API | llama-3.1-70b-versatile (free tier) |
| IA alternativa | Ollama local | Mistral 7B / Phi-3 |
| Filas assíncronas | BullMQ + Redis | Para campanhas em massa |
| ORM | Prisma | Migrations + type-safe queries |
| WebSocket | Socket.io | Realtime no inbox |
| Testes Backend | Jest | Cobertura mínima 70% |
| Testes Frontend | Jasmine + Cypress (e2e) | Cobertura mínima 60% |
| CI/CD | GitHub Actions + Docker Compose | Deploy zero-downtime |
| Logs | Pino | Logs estruturados JSON |
| Erros | Sentry | Rastreamento de exceções |

---

## Estrutura do Monorepo

```
whatflow/
├── apps/
│   ├── api/                  # Node.js + Express (Backend)
│   │   ├── src/
│   │   │   ├── modules/      # Módulos por domínio (auth, instances, flows, ...)
│   │   │   │   └── <module>/
│   │   │   │       ├── <module>.controller.ts
│   │   │   │       ├── <module>.service.ts
│   │   │   │       ├── <module>.repository.ts
│   │   │   │       ├── <module>.schema.ts   # Zod validations
│   │   │   │       └── <module>.routes.ts
│   │   │   ├── core/         # Prisma client, Redis, logger, config
│   │   │   ├── integrations/ # EvolutionApiService, AiService (Groq/Ollama)
│   │   │   ├── queues/       # BullMQ workers e processors
│   │   │   ├── middlewares/  # auth, rateLimit, errorHandler, tenantContext
│   │   │   └── app.ts        # Express setup
│   │   ├── prisma/
│   │   │   ├── schema.prisma # Modelo de dados completo (14 models)
│   │   │   └── migrations/
│   │   └── tests/
│   └── web/                  # Angular SPA (Frontend)
│       ├── src/
│       │   ├── app/
│       │   │   ├── core/     # AuthService, HttpInterceptors, Guards, Providers
│       │   │   ├── shared/   # Componentes compartilhados, pipes, directives
│       │   │   └── modules/  # Módulos lazy-loaded por feature
│       │   │       ├── dashboard/
│       │   │       ├── inbox/
│       │   │       ├── flows/       # Flow Builder (editor visual)
│       │   │       ├── campaigns/
│       │   │       ├── contacts/
│       │   │       ├── instances/
│       │   │       ├── analytics/
│       │   │       └── settings/
│       │   └── environments/
│       └── cypress/          # Testes e2e
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
├── package.json              # Workspace root
└── CLAUDE.md                 # Este arquivo
```

---

## Módulos do sistema

### Backend — módulos principais (`apps/api/src/modules/`)

| Módulo | Responsabilidade |
|--------|-----------------|
| `auth` | Registro, login, refresh, logout, JWT via Supabase Auth |
| `tenants` | CRUD de tenant, configurações, planos |
| `users` | CRUD de usuários, convites, papéis (OWNER/ADMIN/AGENT/VIEWER) |
| `instances` | Conexões WhatsApp via Evolution API, QR Code, status |
| `flows` | CRUD de fluxos, versionamento, publicação |
| `flow-engine` | Motor de execução de fluxo — processa nós, sessões, variáveis |
| `contacts` | CRUD, importação CSV, tags, campos personalizados |
| `conversations` | Inbox, status, atribuição, bot on/off |
| `messages` | Envio/recebimento, histórico paginado, notas internas |
| `campaigns` | CRUD, agendamento, disparo via BullMQ |
| `ai` | AiService com adaptadores Groq e Ollama |
| `webhooks` | Webhooks de saída, deliveries, retry |
| `analytics` | Views SQL, endpoints de métricas, KPIs |
| `webhook-receiver` | Receiver de eventos da Evolution API (POST /webhooks/evolution/:key) |

### Frontend — módulos Angular lazy-loaded (`apps/web/src/app/modules/`)

| Módulo | Componentes principais |
|--------|----------------------|
| `dashboard` | DashboardComponent, KpiCardComponent, MessageChartComponent |
| `inbox` | InboxComponent, ConversationListComponent, ChatWindowComponent, ContactInfoPanelComponent |
| `flows` | FlowListComponent, FlowBuilderComponent, NodePaletteComponent, NodePropertiesPanelComponent, FlowCanvasComponent |
| `campaigns` | CampaignListComponent, CampaignWizardComponent, CampaignProgressComponent |
| `contacts` | ContactListComponent, ContactDetailComponent, ImportCsvComponent |
| `instances` | InstanceListComponent, InstanceCardComponent, QrCodeModalComponent |
| `analytics` | AnalyticsDashboardComponent, MessageVolumeChartComponent, CampaignReportComponent |
| `settings` | SettingsShellComponent, AiConfigComponent, WebhookListComponent, UserManagementComponent |

---

## Modelo de Dados — tabelas principais (Prisma/Supabase)

```
tenants → users, instances, flows, contacts, conversations, campaigns, tags, ai_configs, webhooks, audit_logs
instances → flows, conversations, campaigns
flows → flow_sessions
contacts → conversations, contact_tags, campaign_contacts
conversations → messages, flow_sessions, conversation_notes, conversation_tags
campaigns → campaign_contacts
webhooks → webhook_deliveries
```

**Segurança**: Row Level Security (RLS) via Supabase em todas as tabelas.
O `tenant_id` do JWT é usado pela função `get_current_tenant_id()` em todas as policies.

---

## Integrações externas — contratos

### Evolution API v2
- Base URL: `EVOLUTION_API_URL` (env)
- Auth: header `apikey: EVOLUTION_API_KEY`
- Endpoints usados: `POST /instance/create`, `GET /instance/connectionState/{key}`, `GET /instance/connect/{key}` (QR), `POST /message/sendText/{key}`, `POST /message/sendMedia/{key}`, `POST /webhook/set/{key}`
- Eventos recebidos via webhook: `messages.upsert`, `connection.update`, `qrcode.updated`, `messages.update`

### Groq API (IA gratuita)
- Base URL: `https://api.groq.com/openai/v1`
- Auth: header `Authorization: Bearer GROQ_API_KEY`
- Modelo padrão: `llama-3.1-70b-versatile`
- Endpoint: `POST /chat/completions` (formato OpenAI-compatible)
- Rate limit free: 30 req/min, 14.400 req/dia

### Ollama (IA local — alternativa)
- Base URL: configurável (ex: `http://localhost:11434`)
- Endpoint: `POST /api/chat`
- Modelos sugeridos: `mistral`, `phi3`, `llama3.1`

### Supabase Auth
- JWT contém `app_metadata.tenant_id` e `app_metadata.role`
- Usado pelas RLS policies
- Refresh token: 7 dias, access token: 1 hora

---

## Variáveis de Ambiente (`.env.example`)

```bash
# Banco de dados
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres"
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres"

# Supabase
SUPABASE_URL="https://[REF].supabase.co"
SUPABASE_ANON_KEY="eyJ..."
SUPABASE_SERVICE_ROLE_KEY="eyJ..."
SUPABASE_JWT_SECRET="seu-jwt-secret"

# Evolution API
EVOLUTION_API_URL="http://localhost:8080"
EVOLUTION_API_KEY="sua-chave-global"
EVOLUTION_WEBHOOK_SECRET="secret-para-validar-hmac"

# IA
GROQ_API_KEY="gsk_..."
OLLAMA_BASE_URL="http://localhost:11434"
AI_ENCRYPTION_KEY="32-bytes-para-AES-256"

# Redis (BullMQ)
REDIS_URL="redis://localhost:6379"

# App
NODE_ENV="development"
PORT=3000
JWT_SECRET="secret-do-jwt-proprio"
CORS_ORIGINS="http://localhost:4200"

# Frontend
ANGULAR_API_URL="http://localhost:3000/v1"
SUPABASE_PUBLIC_URL="https://[REF].supabase.co"
SUPABASE_PUBLIC_ANON_KEY="eyJ..."
```

---

## Convenções de Código

### Backend (Node.js/TypeScript)
- **Controllers**: apenas recebem request, validam com Zod, chamam service, retornam response.
- **Services**: toda a lógica de negócio. Nunca acessa banco diretamente.
- **Repositories**: única camada que acessa Prisma. Retorna DTOs tipados.
- **Erros**: usar `AppError` customizado com `statusCode` e `code` string.
- **Validação**: Zod em todos os inputs (`body`, `params`, `query`).
- **Logs**: `logger.info/warn/error` com contexto `{ tenantId, userId, action }`.
- **Async**: sempre `async/await`, nunca callbacks. Erros propagados com `throw`.

### Frontend (Angular)
- **Standalone Components** em todos os novos componentes.
- **Signals** para estado local simples. `RxJS` para streams complexas.
- **Services** com `inject()` — sem constructor injection.
- **HTTP**: sempre via `ApiService` base, nunca `HttpClient` direto nos componentes.
- **Forms**: Reactive Forms com `FormBuilder`.
- **Rotas**: `canActivate` com `AuthGuard`, lazy loading em todos os módulos.

### Git
- Branch pattern: `feat/T-001-monorepo-setup`, `fix/T-015-webhook-receiver`
- Commit pattern: `feat(auth): implement JWT middleware #T-005`
- PR: obrigatório passar CI antes de merge

---

## Decisões Arquiteturais (ADRs resumidos)

| # | Decisão | Motivo |
|---|---------|--------|
| ADR-001 | Supabase ao invés de banco próprio | Auth, RLS, Realtime e Storage prontos. Reduz infra inicial. |
| ADR-002 | Groq ao invés de OpenAI | Free tier generoso (14.400 req/dia), baixa latência, modelos Llama de qualidade. |
| ADR-003 | BullMQ ao invés de cron simples | Campanhas precisam de retry, controle de concorrência e pausa/retomada. |
| ADR-004 | Prisma ao invés de Drizzle | Ecossistema mais maduro, migrations automáticas, melhor DX com TypeScript. |
| ADR-005 | Angular ao invés de React | Stack conhecida pela equipe. Angular Material + CDK para o Flow Builder. |
| ADR-006 | Evolution API ao invés de Twilio | Sem custo por mensagem. Self-hosted. Suporte a WhatsApp Web (não Business API). |
| ADR-007 | Monorepo yarn workspaces | Compartilhar tipos TypeScript entre api e web sem pacote npm extra. |

---

## Documentação gerada (todos os arquivos estão em `/mnt/user-data/outputs/`)

| Arquivo | Conteúdo |
|---------|---------|
| `WhatFlow_PRD_v1.0.docx` | Product Requirements Document completo |
| `WhatFlow_TASKS_v1.0.docx` | 52 tarefas em 6 sprints de 2 semanas |
| `WhatFlow_schema.prisma` | Schema Prisma completo (14 models, índices, enums) |
| `WhatFlow_supabase_rls.sql` | Políticas RLS, funções helper, views analytics, triggers |
| `WhatFlow_openapi.yaml` | Contrato OpenAPI 3.1 com 45+ endpoints documentados |
| `WhatFlow_Wireframes.html` | Wireframes interativos: Dashboard, Inbox, Flow Builder |

---

## Sprint atual: Sprint 1 — Foundation & Infrastructure

**Tarefas em andamento:**

- [ ] T-001 — Inicializar repositório monorepo (yarn workspaces, tsconfig, eslint, husky)
- [ ] T-002 — Docker Compose (api, web, redis, supabase local)
- [ ] T-003 — Pipeline CI/CD GitHub Actions
- [ ] T-004 — Configurar Supabase + Prisma (migrations, RLS)
- [ ] T-005 — Backend: Auth com Supabase Auth
- [ ] T-006 — Políticas RLS no Supabase
- [ ] T-007 — Frontend: Módulo de autenticação Angular

**Definição de pronto (DoD) para Sprint 1:**
- Todos os serviços sobem com `docker compose up`
- `npx prisma migrate dev` executa sem erros
- `yarn lint` e `yarn test` passam no CI
- Login/logout funcionam no frontend
- Usuário de outro tenant não vê dados do primeiro (RLS validado)

---

## Comandos disponíveis (Claude Code — pasta .claude/commands/)

| Comando | Descrição |
|---------|-----------|
| `/executar_inicio` | Guia os 5 passos de setup: wireframes → Supabase → Prisma → RLS → Insomnia + Sprint 1 |
| `/implementar <T-XXX>` | Implementa uma tarefa específica do backlog (ex: `/implementar T-005`) |
| `/status_sprint` | Mostra progresso real do sprint atual analisando os arquivos do projeto |
| `/testar [api\|web]` | Roda testes e exibe cobertura vs meta (backend ≥70%, frontend ≥60%) |

## Arquivos de referência rápida

| Arquivo | Uso |
|---------|-----|
| `apps/api/prisma/schema.prisma` | Modelo de dados completo |
| `docs/WhatFlow_openapi.yaml` | Contratos de todos os endpoints |
| `docs/WhatFlow_Wireframes.html` | Abrir no browser para ver UI |
| `docs/WhatFlow_supabase_rls.sql` | Executar no SQL Editor do Supabase |
| `docs/plugin/whatflow-dev.plugin` | Instalar no Claude Code/Cowork |
