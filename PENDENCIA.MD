# WhatFlow — Pendências (executar depois)

> Itens conhecidos que ficaram em aberto ao fechar o **Sprint 1**.
> Atualizado em 2026-06-24.

---

## 🔴 Bloqueantes de DoD / Infra

| # | Item | Detalhe | Onde |
|---|------|---------|------|
| P-01 | **Validar `docker compose up` (T-002)** | **Passo do usuário:** abrir o Docker Desktop manualmente e concluir o first-run (aceitar termos / login / habilitar WSL) até `docker info` responder. Tentativa headless falhou — o Docker Desktop sobe e fecha, e o engine WSL2 `docker-desktop` não inicializa (pipe `dockerDesktopLinuxEngine` ausente). Depois rodar `docker compose up -d --build` e confirmar api:3000/health e web:4200. | `docker-compose.yml` |

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
