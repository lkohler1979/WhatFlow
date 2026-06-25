# WhatFlow — Pendências (executar depois)

> Itens conhecidos que ficaram em aberto ao fechar o **Sprint 1**.
> Atualizado em 2026-06-24.

---

## 🔴 Bloqueantes de DoD / Infra

| # | Item | Detalhe | Onde |
|---|------|---------|------|
| ~~P-01~~ | ~~Validar `docker compose up` (T-002)~~ | ✅ **FEITO** (2026-06-24): os 4 serviços sobem e respondem — api `/health` 200 (:3000), web 200 (:4200), redis healthy (:6379), bull-board 200 (:3001). | `docker-compose.yml` |

## 🟠 Sprint 2 — Evolution

| # | Item | Detalhe |
|---|------|---------|
| P-16 | **e2e do webhook (T-015) com Evolution local** | Config pronta: `docker compose up` sobe `evolution-api` (v2) + `evolution-postgres`; a API no compose aponta para a Evolution local e registra o webhook (`WEBHOOK_BASE_URL=http://api:3000/v1`). Falta rodar o e2e (criar instância → Evolution chama `POST /v1/webhooks/evolution/:key` → status/QR/mensagens no banco). **Bloqueio:** o Docker Desktop desta máquina é instável (o daemon cai sozinho). Quando estável: `docker compose up -d` e criar uma instância pela tela; ao escanear o QR num WhatsApp de teste chega `messages.upsert`. |

| # | Item | Detalhe |
|---|------|---------|
| ~~P-14~~ | ~~Chave global da Evolution~~ | ✅ **Resolvido**: recebida a `AUTHENTICATION_API_KEY` global; T-013 CRUD validado e2e (create/delete na Evolution real). A chave global está no `.env` (gitignored). |
| P-15 | **Rotacionar a chave global da Evolution** | A `AUTHENTICATION_API_KEY` passou pelo chat — rotacionar no servidor `evo.kellen-ia.com` quando possível e atualizar `.env`/`apps/api/.env`. |
| P-17 | **Excluir instância com conversas falha (FK)** | `DELETE /v1/instances/:id` retorna 500 se a instância já tem `Conversation`/`Message` — a relação `Conversation → Instance` não tem `onDelete: Cascade` no schema. Ajustar no `schema.prisma` (+ migration) ou apagar conversas/mensagens antes no service. |
| P-18 | **Hot-reload do `api` no Docker (Windows)** | O `tsx watch` dentro do container NÃO detecta mudanças no bind mount do Windows → após editar o backend é preciso `docker compose restart api` para o container recarregar. Opções: usar polling do tsx (`--include`/`CHOKIDAR_USEPOLLING`) ou documentar o restart no README. |

## 🔐 Segurança (ação do usuário)

| # | Item | Detalhe |
|---|------|---------|
| P-02 | **Rotacionar `SUPABASE_SERVICE_ROLE_KEY`** | A chave passou por chat/disco. Supabase → Settings → API → roll key. Atualizar `.env` e `apps/api/.env`. |
| P-03 | **Rotacionar senha do banco** | Idem (Settings → Database → Reset password). Atualizar `DATABASE_URL`/`DIRECT_URL` (lembrar do URL-encode de `%`→`%25`, `&`→`%26`). |

## 🧩 Frontend — completar Sprint 1 (T-009 / T-010)

| # | Item | Detalhe |
|---|------|---------|
| P-04 | **Design system / Storybook (T-009)** | Tema global, tokens e componentes base documentados (Storybook ou demo page). Hoje há só estilo mínimo. |
| P-05 | **Breadcrumbs + navegação (T-010)** | Breadcrumbs por rota; estado ativo na sidebar; rótulos das rotas. |
| P-06 | **`forgot-password` real** | Hoje é stub. Implementar reset via Supabase Auth (`resetPasswordForEmail`) quando SMTP estiver configurado. |
| P-07 | **Dashboard com métricas reais** | Cards usam placeholder (`—`). Plugar nos endpoints de analytics (Sprint 6). |

## 🧪 Qualidade / CI (T-050)

| # | Item | Detalhe |
|---|------|---------|
| P-08 | **ESLint do Angular** | Não há config de lint no `apps/web`. Adicionar `angular-eslint` (flat config) e reativar `lint --workspace=apps/web` no CI. |
| P-09 | **Testes do frontend (Karma/Jasmine)** | Falta `tsconfig.spec.json` + target `test` no `angular.json` + specs. Reativar `test --workspace=apps/web` no CI. |
| P-10 | **Cobertura backend ≥ 70% (T-049)** | Hoje só testes de schema (Zod). Adicionar testes de service/controller (mock de Supabase/Prisma) e ligar `test:coverage` no CI. |

## 🛠️ Backend — dívidas técnicas pequenas

| # | Item | Detalhe |
|---|------|---------|
| P-11 | **`GET /auth/me` enriquecido** | Hoje retorna `{ id, tenantId, role }`. Opcional: retornar `user` + `tenant` completos (o frontend já persiste o user do login/register, então não é bloqueante). |
| P-12 | **Migrations no Supabase** | `prisma migrate dev` é interativo-only contra o pooler; o fluxo adotado é **baseline + `prisma migrate deploy`**. Documentar no README para o time. |
| P-13 | **Resolução do `rxjs`** | Mantido via `overrides` (raiz) + `paths` no `tsconfig` do web (conflito 7.8.1 vs 7.8.2). Revisar ao subir versões do Angular/devkit. |

---

## ✅ Concluído no Sprint 1 (referência)
T-001, T-003, T-004, T-005, T-006, T-007, T-008, T-011 — validados.
Detalhes e critérios em [TASKS.md](TASKS.md).
