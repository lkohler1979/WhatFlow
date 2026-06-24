# WhatFlow — Task Breakdown & Sprint Planning

> Versão **1.0** · Junho 2025
> _Documento gerado a partir de `docs/WhatFlow_TASKS_v1.0.docx`._

| | |
|---|---|
| **Total de Sprints** | 6 Sprints (12 semanas) |
| **Duração por Sprint** | 2 semanas |
| **Total de Tarefas** | 52 tarefas organizadas por épico |
| **Metodologia** | Scrum (Sprints de 2 semanas) |
| **Estimativa de Esforço** | P=1d · M=2-3d · G=4-5d · XG=1sem+ |

---

## Visão Geral dos Sprints

| Sprint | Épico Principal | Entregas | Pontos |
|---|---|---|---|
| Sprint 1 | Foundation & Infra | Setup do projeto, autenticação, banco de dados, CI/CD, estrutura base Node + Angular | 21 pts |
| Sprint 2 | WhatsApp Core | Integração Evolution API, gestão de instâncias, webhook receiver, envio de mensagens | 25 pts |
| Sprint 3 | Flow Builder MVP | Editor visual drag-and-drop, motor de fluxo (FlowEngine), nós básicos, publicação | 34 pts |
| Sprint 4 | IA + Campanhas | Integração Groq/Ollama, nó de IA no fluxo, campanhas com BullMQ, agendamento | 29 pts |
| Sprint 5 | Inbox + Contatos | Caixa de entrada unificada, realtime, transferência bot→humano, gestão de contatos | 27 pts |
| Sprint 6 | Analytics + Polish | Dashboard métricas, relatórios, webhooks de saída, ajustes UX, testes, deploy | 24 pts |

**Legenda de status:** ⬜ pendente · 🟡 em andamento · ✅ concluído

---

## Sprint 1 — Foundation & Infrastructure
**Objetivo:** Estabelecer toda a base do projeto — estrutura de pastas, banco de dados, autenticação, CI/CD e componentes base do frontend. Ao final, o ambiente de desenvolvimento está 100% operacional.

### ÉPICO 1.1 — Setup do Projeto e DevOps
| ID | Tarefa | Critérios de Aceite | Prio | Esforço | Deps | Status |
|---|---|---|---|---|---|---|
| T-001 | Inicializar repositório monorepo | `npm install` funciona. Lint e build (API) passam sem erros. Husky bloqueia commit com lint error. | Alta | M | — | ✅ |
| T-002 | Docker Compose para ambiente dev | `docker compose up` inicia todos os serviços. API responde em :3000, Web em :4200. | Alta | M | T-001 | ✅ (validado: api `/health` 200 :3000, web 200 :4200, redis healthy :6379, bull-board 200 :3001. Dockerfiles com contexto raiz; API em node:20-slim p/ Prisma; web sem lockfile p/ binários nativos Linux; sem volumes anônimos de node_modules) |
| T-003 | Pipeline CI/CD GitHub Actions | PR dispara pipeline. Falha em teste bloqueia merge. Deploy staging funciona. | Alta | M | T-001 | ✅ |
| T-004 | Configurar Supabase e Prisma | `npx prisma migrate dev` funciona. Todas as tabelas criadas no Supabase. RLS ativo. | Alta | G | T-002 | ✅ (migration baseline aplicada via pooler IPv4 — 19 tabelas; RLS aplicado via supabase_rls.sql) |

### ÉPICO 1.2 — Autenticação e Multi-Tenancy
| ID | Tarefa | Critérios de Aceite | Prio | Esforço | Deps | Status |
|---|---|---|---|---|---|---|
| T-005 | Backend: Auth com Supabase Auth | Usuário registra, recebe JWT. Token expirado retorna 401. Tenant criado no registro. | Alta | G | T-004 | ✅ (validado e2e: register cria tenant+JWT; /me 200 com claims; token inválido 401. Middleware verifica via JWKS/ES256) |
| T-006 | Políticas RLS no Supabase | Usuário A não vê dados do usuário B. Testes de isolamento passam. | Alta | M | T-004 | ✅ (isolamento validado via PostgREST: tenant A só vê dados de A e vice-versa. Script: `npm run rls:smoke`) |
| T-007 | Frontend: Módulo de autenticação Angular | Login funciona. Token salvo. Rota `/dashboard` exige auth. Logout limpa token. | Alta | G | T-005 | ✅ (validado no browser: register→token salvo→guard libera→/dashboard; shell separado do root). Falta botão de logout na UI |
| T-008 | Gestão de usuários e papéis | OWNER convida AGENT. AGENT não acessa billing. Guards bloqueiam acessos. | Média | M | T-005 | ✅ (módulo users: list/invite/role/remove escopado por tenant; `requireRole`→403; validado e2e: OWNER convida=201, AGENT convida=403, list=200, sem token=401) |

### ÉPICO 1.3 — Estrutura Base do Frontend
| ID | Tarefa | Critérios de Aceite | Prio | Esforço | Deps | Status |
|---|---|---|---|---|---|---|
| T-009 | Scaffold Angular com design system | Storybook ou demo page mostra todos os componentes. Tema aplicado globalmente. | Alta | G | T-007 | 🟡 (app Angular bootstrapado: angular.json, main.ts, index.html, tsconfig.app; `ng build` passa. Falta design system/Storybook) |
| T-010 | Roteamento e módulos lazy-loaded | Navegação funciona. Módulos carregam sob demanda. Breadcrumbs corretos. | Alta | M | T-009 | 🟡 (rotas lazy dos 8 módulos compilam em chunks separados; falta breadcrumbs) |
| T-011 | Dashboard básico com métricas placeholder | Dashboard renderiza em desktop e mobile. Cards visíveis. Layout correto. | Média | P | T-010 | ✅ (4 KPI cards responsivos + header com usuário/papel e botão Sair; logout valida limpa token e volta ao /auth/login) |

---

## Sprint 2 — WhatsApp Core (Evolution API)
**Objetivo:** Integrar completamente com a Evolution API. Ao final, é possível conectar um número WhatsApp, receber e enviar mensagens manualmente.

### ÉPICO 2.1 — Integração Evolution API
| ID | Tarefa | Critérios de Aceite | Prio | Esforço | Deps | Status |
|---|---|---|---|---|---|---|
| T-012 | Módulo de integração Evolution API (backend) | Testes unitários cobrem todos os métodos. Retry funciona em falha temporária. | Alta | G | T-004 | ✅ (evolution-api.service: createInstance/connectionState/connect/sendText/sendMedia/setWebhook + retry/backoff em rede/5xx, sem retry em 4xx. 11 testes unitários com HTTP mockado) |
| T-013 | CRUD de Instâncias WhatsApp | CRUD funciona via API. Status atualizado ao conectar/desconectar. | Alta | M | T-012 | 🟡 (módulo instances: list/create/get/qrcode/delete escopado por tenant, integra Evolution + persiste no banco, mapeia status open/connecting/close. Build/lint/26 testes OK. Integração validada ao vivo read-only na TrilhaDBV; falta e2e HTTP completo create→delete) |
| T-014 | QR Code e pareamento | QR exibido no frontend. Status muda para 'Connected' ao escanear. WebSocket notifica. | Alta | M | T-013 | ⬜ |
| T-015 | Receiver de Webhooks da Evolution API | Mensagem enviada para número conectado aparece no banco. Eventos processados corretamente. | Alta | G | T-013 | ⬜ |

### ÉPICO 2.2 — Tela de Instâncias no Frontend
| ID | Tarefa | Critérios de Aceite | Prio | Esforço | Deps | Status |
|---|---|---|---|---|---|---|
| T-016 | Tela de gestão de instâncias | Usuário cria instância, escaneia QR, status muda para Connected em < 5s. | Alta | G | T-014, T-015 | ⬜ |
| T-017 | Envio manual de mensagem de teste | Mensagem enviada aparece no WhatsApp do destinatário. Histórico visível. | Média | M | T-015 | ⬜ |
| T-018 | WebSocket setup (Socket.io) | Status de instância atualiza no frontend sem refresh. Reconexão testada. | Alta | M | T-015 | ⬜ |

---

## Sprint 3 — Flow Builder (Editor Visual de Fluxos)
**Objetivo:** Criar o editor visual de chatbot. Ao final, é possível criar um fluxo, publicá-lo e ter o bot respondendo automaticamente baseado no fluxo.

### ÉPICO 3.1 — Motor de Fluxo (Backend)
| ID | Tarefa | Critérios de Aceite | Prio | Esforço | Deps | Status |
|---|---|---|---|---|---|---|
| T-019 | Modelo de dados de fluxos e FlowEngine | FlowEngine processa fluxo simples (texto → opção → resposta) corretamente nos testes. | Alta | XG | T-015 | ⬜ |
| T-020 | Implementar tipos de nós do fluxo | Cada tipo de nó testado individualmente. Fluxo com todos os tipos executa corretamente. | Alta | XG | T-019 | ⬜ |
| T-021 | CRUD de fluxos e versionamento | Publicar fluxo cria versão imutável. Bot usa versão publicada. Rascunho não afeta bot ativo. | Alta | M | T-019 | ⬜ |
| T-022 | Integração FlowEngine com webhook receiver | Bot responde ao trigger 'oi'. Avança pelo fluxo conforme input do usuário. | Alta | G | T-020, T-021 | ⬜ |

### ÉPICO 3.2 — Editor Visual Frontend
| ID | Tarefa | Critérios de Aceite | Prio | Esforço | Deps | Status |
|---|---|---|---|---|---|---|
| T-023 | Integração do editor de grafos (ngx-graph ou Angular CDK) | Usuário arrasta nó, conecta com outro, salva. Layout persiste ao reabrir. | Alta | XG | T-021 | ⬜ |
| T-024 | Painel de propriedades dos nós | Cada tipo de nó tem formulário específico. Mudanças refletem no nó do canvas. | Alta | G | T-023 | ⬜ |
| T-025 | Variáveis dinâmicas e preview | Clicar em variável insere no campo. Preview mostra valor substituído. Variável inválida alerta. | Média | M | T-024 | ⬜ |
| T-026 | Tela de listagem de fluxos | Listagem carrega. Filtros funcionam. Ações executadas com feedback visual. | Média | M | T-021 | ⬜ |

---

## Sprint 4 — IA Integration + Campanhas
**Objetivo:** Adicionar inteligência artificial ao fluxo e implementar o módulo de campanhas com filas assíncronas.

### ÉPICO 4.1 — Integração com IA (Groq / Ollama)
| ID | Tarefa | Critérios de Aceite | Prio | Esforço | Deps | Status |
|---|---|---|---|---|---|---|
| T-027 | AiService com suporte a Groq e Ollama | Ambos adaptadores geram resposta. Switch de provedor transparente. Timeout configurável. | Alta | G | T-004 | ⬜ |
| T-028 | Nó de IA no FlowEngine | Bot com nó de IA responde perguntas abertas de forma contextual. Histórico incluído. | Alta | G | T-027, T-020 | ⬜ |
| T-029 | Configuração de IA por tenant | Configurações salvas. Botão 'Testar' chama IA e exibe resposta de exemplo. | Média | M | T-027 | ⬜ |
| T-030 | Rate limiting e cache de respostas IA | Limite de req/min respeitado. Cache reduz chamadas redundantes. Consumo visível. | Média | M | T-027 | ⬜ |

### ÉPICO 4.2 — Campanhas e Disparos em Massa
| ID | Tarefa | Critérios de Aceite | Prio | Esforço | Deps | Status |
|---|---|---|---|---|---|---|
| T-031 | Setup BullMQ + Redis para filas | Jobs adicionados à fila são processados. Retry automático em falha. Bull-Board acessível. | Alta | M | T-004 | ⬜ |
| T-032 | CRUD de campanhas (backend) | Campanha criada, iniciada, pausada, cancelada. Status atualizado corretamente. | Alta | G | T-031 | ⬜ |
| T-033 | Processador de campanha com anti-ban | Campanha de 50 contatos enviada com delays. Progresso visível em tempo real. | Alta | G | T-032 | ⬜ |
| T-034 | Tela de campanhas no frontend | Usuário cria e dispara campanha pela UI. Progresso atualiza sem refresh. | Alta | G | T-032, T-033 | ⬜ |
| T-035 | Upload e gestão de lista de contatos para campanha | CSV com 1000 linhas importado em < 10s. Números inválidos sinalizados. Preview correto. | Média | M | T-034 | ⬜ |

---

## Sprint 5 — Inbox Unificada + Contatos
**Objetivo:** Criar a caixa de entrada unificada com atendimento humano e o módulo completo de contatos.

### ÉPICO 5.1 — Inbox e Atendimento Humano
| ID | Tarefa | Critérios de Aceite | Prio | Esforço | Deps | Status |
|---|---|---|---|---|---|---|
| T-036 | API de conversas e mensagens | Conversas filtradas. Mensagens paginadas (cursor-based). Agente envia mensagem. | Alta | G | T-022 | ⬜ |
| T-037 | Tela Inbox com layout 3 colunas | Inbox carrega. Scroll infinito funciona. Painel de contato exibe dados corretos. | Alta | XG | T-036 | ⬜ |
| T-038 | Realtime no Inbox (Supabase Realtime) | Mensagem recebida aparece em < 1s sem refresh. Badge de não lidos atualiza. | Alta | G | T-037 | ⬜ |
| T-039 | Transferência bot↔humano | Agente desativa bot. Agente responde. Bot não interfere. Reativação funciona. | Alta | M | T-037 | ⬜ |
| T-040 | Notas internas e tags de conversa | Nota salva. Nota não enviada ao WhatsApp. Tags filtram na listagem. | Média | M | T-037 | ⬜ |

### ÉPICO 5.2 — Módulo de Contatos
| ID | Tarefa | Critérios de Aceite | Prio | Esforço | Deps | Status |
|---|---|---|---|---|---|---|
| T-041 | CRUD completo de contatos | Importar 500 contatos em < 15s. Busca por nome/número funciona. Export correto. | Alta | G | T-004 | ⬜ |
| T-042 | Tela de contatos e segmentação | Filtro por tag funciona. Histórico do contato visível. Bulk action em 100 contatos. | Alta | G | T-041 | ⬜ |
| T-043 | Sistema de tags global | Tag criada aparece no autocomplete. Filtro por tag funciona em contatos e conversas. | Média | M | T-041 | ⬜ |

---

## Sprint 6 — Analytics, Webhooks e Polish
**Objetivo:** Dashboard analítico, webhooks de saída, ajustes de UX, cobertura de testes e deploy em produção.

### ÉPICO 6.1 — Analytics e Relatórios
| ID | Tarefa | Critérios de Aceite | Prio | Esforço | Deps | Status |
|---|---|---|---|---|---|---|
| T-044 | Endpoints de métricas e analytics | Todas as queries < 500ms. Dados corretos vs banco raw. | Alta | G | T-036, T-034 | ⬜ |
| T-045 | Dashboard principal com gráficos | Gráficos renderizam. Filtro de período funciona. Dados batem com relatório CSV. | Alta | G | T-044 | ⬜ |
| T-046 | Relatórios exportáveis | CSV gerado tem dados corretos. Excel abre sem erros. Download funciona. | Média | M | T-044 | ⬜ |

### ÉPICO 6.2 — Webhooks de Saída e Integrações
| ID | Tarefa | Critérios de Aceite | Prio | Esforço | Deps | Status |
|---|---|---|---|---|---|---|
| T-047 | Sistema de webhooks de saída | Webhook disparado em evento. Log exibe status, tempo, resposta. Retry em falha. | Alta | G | T-031 | ⬜ |
| T-048 | Tela de configuração de webhooks | Usuário cria webhook, testa, vê histórico. Falha exibe mensagem de erro da resposta. | Média | M | T-047 | ⬜ |

### ÉPICO 6.3 — Qualidade, Testes e Deploy
| ID | Tarefa | Critérios de Aceite | Prio | Esforço | Deps | Status |
|---|---|---|---|---|---|---|
| T-049 | Cobertura de testes backend (70%+) | `jest --coverage` mostra ≥ 70% linhas. Pipeline CI bloqueia se < 70%. | Alta | G | T-022, T-028, T-033 | ⬜ |
| T-050 | Cobertura de testes frontend (60%+) | Karma coverage ≥ 60%. Cypress e2e roda nos 4 fluxos críticos sem falha. | Alta | G | T-026, T-034, T-037 | ⬜ |
| T-051 | Deploy em produção (Docker + VPS/Cloud) | App acessível via HTTPS. Deploy sem downtime. Rollback em < 2 min. | Alta | G | T-049, T-050 | ⬜ |
| T-052 | Documentação técnica e README | Dev novo roda o projeto em < 30min seguindo o README. Swagger acessível. | Média | M | T-051 | ⬜ |

---

## Diagrama de Dependências Críticas
Sequência obrigatória para evitar bloqueios entre tasks:

```
Fase 1 (Base)      T-001 → T-002 → T-004 → T-005/T-006 → T-007
Fase 2 (Core)      T-004 → T-012 → T-013 → T-014/T-015 → T-016
Fase 3 (Features)  T-015 → T-019 → T-020 → T-021/T-022 ; T-027 → T-028 ; T-031 → T-032 → T-033
Fase 4 (Polish)    T-036/T-034 → T-044 → T-045 ; T-049/T-050 → T-051 → T-052
```

## Resumo Executivo

| Sprint | Tarefas | Entregáveis-chave |
|---|---|---|
| Sprint 1 (Sem 1-2) | 11 tarefas | Infra, Auth, UI base |
| Sprint 2 (Sem 3-4) | 7 tarefas | Evolution API, QR Code, Webhook |
| Sprint 3 (Sem 5-6) | 8 tarefas | FlowEngine, Flow Builder visual |
| Sprint 4 (Sem 7-8) | 9 tarefas | IA Groq/Ollama, Campanhas BullMQ |
| Sprint 5 (Sem 9-10) | 8 tarefas | Inbox realtime, Contatos |
| Sprint 6 (Sem 11-12) | 9 tarefas | Analytics, Webhooks, Deploy |
| **TOTAL** | **52 tarefas** | Sistema completo em produção |

---

_WhatFlow — Task Document confidencial para uso interno da equipe de engenharia · Versão 1.0 · Junho 2025_
