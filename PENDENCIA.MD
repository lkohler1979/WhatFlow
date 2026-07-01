# WhatFlow — Pendências (executar depois)

> Itens conhecidos que ficaram em aberto ao fechar o **Sprint 1**.
> Atualizado em 2026-06-30.

---

## 🔴 Bloqueantes de DoD / Infra

| # | Item | Detalhe | Onde |
|---|------|---------|------|
| ~~P-01~~ | ~~Validar `docker compose up` (T-002)~~ | ✅ **FEITO** (2026-06-24): os 4 serviços sobem e respondem — api `/health` 200 (:3000), web 200 (:4200), redis healthy (:6379), bull-board 200 (:3001). | `docker-compose.yml` |

## 🟠 Sprint 2 — Evolution

| # | Item | Detalhe |
|---|------|---------|
| ~~P-16~~ | ~~e2e do webhook (T-015) + bot (T-022) com Evolution local~~ | ✅ **FEITO** (2026-06-29): e2e real validado ponta a ponta. Instância criada → QR escaneado → `connection.update`/`qrcode.updated`/`messages.upsert` chegam ao `POST /v1/webhooks/evolution/:key` → bot casa o gatilho `oi`, envia boas-vindas+menu **de volta ao remetente** e persiste a `FlowSession` (WAITING no menu). **2 bugs reais corrigidos:** (1) o Baileys anunciava versão WA desatualizada → loop `connecting/close statusReason:405`, QR nunca gerava → fixado `CONFIG_SESSION_PHONE_VERSION` no compose (versão atual do WhatsApp Web; ver wppconnect-team/wa-version). (2) O WhatsApp moderno mascara o remetente com `@lid`; o `sender` do envelope é o **dono da instância**, NÃO o remetente — responder a ele mandava a resposta para o próprio número conectado. **Correção:** responder ao `remoteJid` original (jid completo p/ `@lid`) + **upgrade da Evolution `v2.1.1`→`evoapicloud/evolution-api:v2.3.7`**, que estendeu o bypass de existência para `@lid` (a v2.1.1 recusava com `Bad Request exists:false`). |

| # | Item | Detalhe |
|---|------|---------|
| ~~P-14~~ | ~~Chave global da Evolution~~ | ✅ **Resolvido**: recebida a `AUTHENTICATION_API_KEY` global; T-013 CRUD validado e2e (create/delete na Evolution real). A chave global está no `.env` (gitignored). |
| P-15 | **Rotacionar a chave global da Evolution** | A `AUTHENTICATION_API_KEY` passou pelo chat — rotacionar no servidor `evo.kellen-ia.com` quando possível e atualizar `.env`/`apps/api/.env`. |
| ~~P-17~~ | ~~Excluir instância com conversas falha (FK)~~ | ✅ **Resolvido**: relação `Conversation → Instance` agora tem `onDelete: Cascade` no `schema.prisma` + migration `20260626083644_conversation_instance_cascade`. `DELETE /v1/instances/:id` não falha mais por FK. |
| ~~P-18~~ | ~~Hot-reload do `api` no Docker (Windows)~~ | ✅ **Mitigado**: adicionados `CHOKIDAR_USEPOLLING=true` e `WATCHPACK_POLLING=true` ao serviço `api` no `docker-compose.yml` para o `tsx watch` detectar mudanças no bind mount do Windows. Fallback: `docker compose restart api`. |

## 🔐 Segurança (ação do usuário)

| # | Item | Detalhe |
|---|------|---------|
| P-02 | **Rotacionar `SUPABASE_SERVICE_ROLE_KEY`** | A chave passou por chat/disco. Supabase → Settings → API → roll key. Atualizar `.env` e `apps/api/.env`. |
| P-03 | **Rotacionar senha do banco** | Idem (Settings → Database → Reset password). Atualizar `DATABASE_URL`/`DIRECT_URL` (lembrar do URL-encode de `%`→`%25`, `&`→`%26`). |
| P-20 | **Rotacionar `GROQ_API_KEY`** | A chave da Groq passou pelo chat (2026-06-30) e está só em `.env`/`apps/api/.env` (gitignored). Revogar/rotacionar no console da Groq quando possível e atualizar os `.env`. |

## 🧩 Frontend — completar Sprint 1 (T-009 / T-010)

| # | Item | Detalhe |
|---|------|---------|
| ~~P-04~~ | ~~Design system / Storybook (T-009)~~ | ✅ **FEITO** (2026-07-01): o tema global/tokens/mixins já existiam (`styles/_variables.scss`, `_theme.scss` com Angular Material, `_mixins.scss`, classes `.wf-btn`/`.wf-input`/`.wf-badge`/`.card` em `styles.scss`) — o que faltava era **documentação visível**. Criada `StyleGuideComponent` (`/settings/style-guide`, link "Design System" nas Configurações) mostrando cores, neutros, tipografia, espaçamento, raios, botões, campos, badges e card — tudo com as classes/tokens reais do app (não sintético). Optei por demo page em vez de Storybook (zero deps novas, documenta o que já está em produção). Validado: dev server (hot-reload) compilou sem erro, 114 testes mantidos. |
| ~~P-05~~ | ~~Breadcrumbs + navegação (T-010)~~ | ✅ **Resolvido**: `BreadcrumbsComponent` monta trilha por rota, `SidebarNavComponent` usa estado ativo via `RouterLinkActive` e os rótulos principais estão definidos. |
| ~~P-06~~ | ~~`forgot-password` real~~ | ✅ **Resolvido** (2026-06-30): `POST /v1/auth/forgot-password` dispara `resetPasswordForEmail` via Supabase Auth com redirect para `/auth/reset-password`; frontend ganhou formulário de solicitação e tela para gravar nova senha a partir do link de recuperação. Requer SMTP configurado no Supabase e `supabaseUrl`/`supabaseAnonKey` públicos no environment do web para concluir a troca de senha. |
| ~~P-07~~ | ~~Dashboard com métricas reais~~ | ✅ **Resolvido**: dashboard consome endpoints de analytics, exibe KPIs reais, gráfico de volume de mensagens e exportação CSV por período. |

## 🎨 Sprint 3 — Flow Builder (verificação visual)

| # | Item | Detalhe |
|---|------|---------|
| ~~P-19~~ | ~~Validação visual do Flow Builder no browser~~ | ✅ **FEITO** (2026-06-30, via T-050): `flow-builder.cy.ts` roda de verdade (Electron headless) e passa — cria fluxo → edita nós/propriedades → variável `{{}}` + preview → move card → conecta TEXT/MENU/CONDITION → salva → reabre → publica → duplica. Achou e corrigiu um **bug real**: `ngOnInit` lia `route.snapshot.paramMap` (uma vez só) em vez de `route.paramMap.subscribe` — ao duplicar um fluxo, a URL mudava mas os dados do fluxo antigo continuavam na tela até F5 manual. Corrigido. |

## 🧪 Qualidade / CI (T-050)

| # | Item | Detalhe |
|---|------|---------|
| ~~P-08~~ | ~~ESLint do Angular~~ | ✅ **FEITO** (2026-07-01): `angular-eslint@17.5.3` (pacotes separados — a versão unificada só existe p/ Angular 18+), `.eslintrc.json` na raiz do `apps/web` + target `lint` no `angular.json`. Achou e corrigiu 5 problemas reais: BOM literal em regex, imports/params não usados, e **2 `@Output()` chamados `select`** colidindo com o evento nativo do DOM (`@angular-eslint/no-output-native`) — renomeados p/ `selected`/`chosen` em `conversation-list` e `tag-autocomplete` (+ 4 consumidores atualizados). Isolou `@typescript-eslint@7.x` localmente em `apps/web` p/ não colidir com o `v8.x` hoisted da API. `lint --workspace=apps/web` limpo. |
| ~~P-09~~ | ~~Testes do frontend (Karma/Jasmine)~~ | ✅ **FEITO** (T-050, 2026-06-30): `karma.conf.js`/`test.ts`/`tsconfig.spec.json`/target `test`; 114 testes, 84% linhas. `test --workspace=apps/web` reativado no CI (`ci.yml`, job web, com `CHROME_BIN`). |
| ~~P-10~~ | ~~Cobertura backend ≥ 70% (T-049)~~ | ✅ **FEITO** (2026-06-30): 118 testes novos (repositories/controllers/middlewares/auth+users.service), 80.12% linhas. `test:coverage` ligado no CI (job api). |

## 🛠️ Backend — dívidas técnicas pequenas

| # | Item | Detalhe |
|---|------|---------|
| ~~P-11~~ | ~~`GET /auth/me` enriquecido~~ | ✅ **FEITO** (2026-07-01): retorna `{ id, tenantId, role, user: {...}, tenant: {...} }` (mantidos os campos flat p/ compatibilidade). `authRepository.findUserWithTenantBySupabaseUid` (Prisma `include: tenant`); 404→401 se o perfil não existir. Validado ao vivo. |
| ~~P-12~~ | ~~Migrations no Supabase~~ | ✅ **Resolvido** (2026-06-30): README documenta o fluxo **baseline + `prisma migrate deploy`**, quickstart passou a usar `npm run prisma:deploy` e os scripts raiz/API agora expõem `prisma:deploy`. |
| P-13 | **Resolução do `rxjs`** | Mantido via `overrides` (raiz) + `paths` no `tsconfig` do web (conflito 7.8.1 vs 7.8.2). Revisar ao subir versões do Angular/devkit. |

---

## ✅ Concluído no Sprint 1 (referência)
T-001, T-003, T-004, T-005, T-006, T-007, T-008, T-011 — validados.
Detalhes e critérios em [TASKS.md](TASKS.md).
