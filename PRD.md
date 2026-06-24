# WhatFlow — Product Requirements Document (PRD)

> **Plataforma de Automação para WhatsApp com IA**
> Versão **1.0.0 — MVP** · Junho 2025 · Stack: Node.js • Angular • Supabase
>
> _Documento gerado a partir de `docs/WhatFlow_PRD_v1.0.docx`._

---

## 1. Visão Geral do Produto

### 1.1 Descrição
O **WhatFlow** é uma plataforma SaaS multi-tenant voltada para empresas que desejam automatizar
o atendimento e o engajamento via WhatsApp. Inspirado no SMBot (smbot.com.br), o produto oferece
criação de fluxos conversacionais visuais (chatbot), disparo de campanhas em massa, integração com
inteligência artificial (modelos gratuitos via API pública), gestão de múltiplas instâncias via
Evolution API e dashboard analítico em tempo real.

### 1.2 Problema a Resolver
- Empresas perdem leads por falta de atendimento imediato fora do horário comercial.
- Campanhas de marketing via WhatsApp são feitas manualmente, gerando retrabalho.
- Não há visibilidade sobre métricas de engajamento, taxa de resposta e performance dos bots.
- Integrar WhatsApp com sistemas internos (CRM, e-commerce) é tecnicamente complexo.

### 1.3 Proposta de Valor
- Plataforma visual **sem código** para criar fluxos de chatbot.
- **IA integrada** para respostas automáticas inteligentes (modelo free).
- Suporte nativo a **múltiplas conexões WhatsApp** por conta (via Evolution API).
- **Analytics em tempo real** com métricas de conversas, campanhas e atendimento.
- Infraestrutura escalável com **Supabase** (PostgreSQL + Realtime + Auth).

---

## 2. Stack Tecnológico

| Componente | Tecnologia / Biblioteca |
|---|---|
| Backend (API REST) | Node.js 20 LTS + Express 5 + TypeScript |
| Frontend (SPA) | Angular 17+ com Standalone Components |
| Banco de Dados | Supabase (PostgreSQL 15 + Auth + Realtime + Storage) |
| WhatsApp Gateway | Evolution API v2 (self-hosted ou cloud) |
| Inteligência Artificial | Groq API (Llama 3.1 70B — gratuito) ou Ollama local |
| Fila de Tarefas | BullMQ + Redis (para disparos em massa) |
| WebSocket | Socket.io (notificações e chat em tempo real) |
| Autenticação | Supabase Auth (JWT) + Guards Angular |
| Upload de Arquivos | Supabase Storage (mídia do WhatsApp) |
| Agendamento | node-cron (campanhas agendadas) |
| ORM | Prisma ORM (migrations + type-safe queries) |
| Testes | Jest (backend) + Jasmine/Karma (frontend) |
| CI/CD | GitHub Actions + Docker Compose |
| Monitoramento | Pino Logger + Sentry (erros) |

---

## 3. Arquitetura do Sistema

### 3.1 Visão Geral
A plataforma segue arquitetura em camadas com separação clara entre Frontend (Angular SPA),
Backend (Node.js API), Serviços de Integração (Evolution API + IA) e Banco de Dados (Supabase/PostgreSQL).

**Camadas:**
- **Presentation Layer** — Angular SPA com módulos lazy-loaded, roteamento protegido por guards, comunicação via HTTP interceptors e WebSocket.
- **API Layer** — Node.js com Express, `controllers → services → repositories`, validação com Zod, autenticação JWT.
- **Integration Layer** — Adaptadores para Evolution API e modelos de IA (Groq/Ollama), com circuit breaker e retry pattern.
- **Data Layer** — Supabase como backend-as-a-service, Prisma ORM para migrations e queries type-safe, Row Level Security (RLS) para multi-tenancy.
- **Queue Layer** — BullMQ + Redis para processamento assíncrono de campanhas e disparos em massa.

### 3.2 Multi-Tenancy
Cada conta (tenant) possui isolamento via **RLS do Supabase**. Todas as tabelas possuem coluna
`tenant_id` com políticas de segurança em nível de row. Um tenant pode ter múltiplas instâncias
WhatsApp e múltiplos usuários com papéis (Admin, Agente, Visualizador).

### 3.3 Fluxo de Mensagem Recebida
1. Evolution API recebe mensagem do WhatsApp e dispara webhook para o backend.
2. Backend identifica o tenant via `instanceId`, verifica se há fluxo ativo para o contato.
3. Motor de fluxo (**FlowEngine**) processa o nó atual e determina a próxima ação.
4. Se o nó é do tipo **AI**, chama o serviço de IA (Groq) para gerar resposta contextual.
5. Resposta é enviada via Evolution API e log salvo no Supabase.
6. Frontend recebe atualização via WebSocket (Socket.io / Supabase Realtime).

---

## 4. Módulos Funcionais

### 4.1 Autenticação e Gestão de Contas
- Registro de empresas com plano (Free / Pro / Enterprise).
- Login com e-mail/senha via Supabase Auth.
- Recuperação de senha por e-mail.
- Gerenciamento de usuários por tenant (convidar, definir papel, remover).
- 2FA opcional via TOTP.

### 4.2 Gestão de Instâncias WhatsApp
- Criar, listar, pausar e excluir instâncias via Evolution API.
- Exibição de QR Code para pareamento do dispositivo.
- Status em tempo real (Connected, Disconnected, QR Pending).
- Suporte a múltiplas instâncias por conta.
- Configuração de webhook por instância.

### 4.3 Construtor Visual de Fluxos (Flow Builder)
- Editor drag-and-drop baseado em Angular CDK ou ngx-graph.
- Tipos de nós: Mensagem de Texto, Imagem, Vídeo, Áudio, Documento, Menu de Opções, Condição (if/else), Delay, Variável, Webhook, IA, Encaminhar para Humano, Fim.
- Variáveis dinâmicas: `{{nome}}`, `{{numero}}`, `{{opcao_selecionada}}`, `{{data}}`, `{{hora}}`.
- Condições baseadas em texto recebido, horário, tag do contato.
- Versionamento de fluxos (salvar rascunho, publicar versão).
- Duplicar, exportar e importar fluxos em JSON.

### 4.4 Integração com IA
- Nó de IA no fluxo para geração de respostas naturais.
- Provedor principal: **Groq API** (Llama 3.1 70B — tier free generoso).
- Provedor alternativo: **Ollama local** (Mistral 7B, Phi-3).
- Contexto configurável: system prompt personalizado por fluxo/instância.
- Limite de tokens configurável por nó.
- Histórico de conversa enviado como contexto (janela configurável).
- Fallback para resposta padrão em caso de erro na IA.

### 4.5 Campanhas e Disparos em Massa
- Criar campanha com lista de contatos (upload CSV ou seleção de grupo).
- Editor de mensagem com variáveis dinâmicas e mídias.
- Agendamento de envio (data/hora específica ou recorrente via cron).
- Controle de intervalo entre mensagens (anti-ban).
- Acompanhamento em tempo real: total, enviado, entregue, lido, erro.
- Pausar, retomar e cancelar campanhas ativas.

### 4.6 Caixa de Entrada Unificada (Inbox)
- Todas as conversas de todas as instâncias em uma tela.
- Filtros por instância, status (aberto, pendente, resolvido), agente, tag.
- Atribuição de conversa a agente humano.
- Chat interno (notas privadas entre agentes).
- Transferência de bot para humano e vice-versa.
- Tags e anotações por contato.
- Visualização de histórico completo do contato.

### 4.7 Contatos e Segmentação
- Importar contatos via CSV.
- Campos personalizados por contato.
- Sistema de tags para segmentação.
- Histórico de interações e campanhas por contato.
- Bloqueio de contato por instância.

### 4.8 Analytics e Relatórios
- Dashboard geral: total de mensagens enviadas/recebidas, conversas abertas, taxa de resposta.
- Métricas por instância, por fluxo, por campanha.
- Gráficos de volume de mensagens por hora/dia/semana.
- Tempo médio de resposta e resolução.
- Relatório de performance dos agentes.
- Exportação de relatórios em CSV/Excel.

### 4.9 Webhooks e Integrações Externas
- Configurar webhooks de saída por evento (mensagem recebida, fluxo concluído, lead capturado).
- Payload configurável em JSON.
- Suporte a autenticação Bearer Token nos webhooks de saída.
- Logs de entrega de webhook (status, tempo, resposta).

---

## 5. Modelo de Dados (Supabase/PostgreSQL)

Principais entidades com relações e políticas RLS. (Schema completo em
[`apps/api/prisma/schema.prisma`](apps/api/prisma/schema.prisma).)

| Tabela | Principais Colunas | Descrição |
|---|---|---|
| `tenants` | id, name, plan, settings_json, created_at | Empresa/organização |
| `users` | id, tenant_id, email, role, full_name, avatar_url | Usuários do sistema |
| `instances` | id, tenant_id, name, phone, status, evolution_key | Conexões WhatsApp |
| `flows` | id, tenant_id, instance_id, name, trigger, nodes_json, status, version | Fluxos de chatbot |
| `contacts` | id, tenant_id, phone, name, tags, custom_fields_json | Contatos do WhatsApp |
| `conversations` | id, tenant_id, instance_id, contact_id, status, assigned_to, bot_active | Threads de conversa |
| `messages` | id, conversation_id, direction, type, content, media_url, timestamp, status | Mensagens trocadas |
| `campaigns` | id, tenant_id, instance_id, name, status, scheduled_at, config_json | Campanhas de disparo |
| `campaign_contacts` | id, campaign_id, contact_id, status, sent_at, error_msg | Contatos de campanha |
| `ai_configs` | id, tenant_id, provider, model, system_prompt, max_tokens, api_key_enc | Configurações de IA |
| `webhooks` | id, tenant_id, url, events_json, secret, active | Webhooks de saída |
| `audit_logs` | id, tenant_id, user_id, action, entity, entity_id, metadata_json, ip | Log de auditoria |

---

## 6. Requisitos Não Funcionais

| Requisito | Critério de Aceite |
|---|---|
| Performance | API responde < 200ms (p95). Inbox atualiza em < 500ms via Realtime. |
| Escalabilidade | Arquitetura stateless permite escalar horizontalmente. BullMQ distribui carga. |
| Segurança | HTTPS obrigatório. JWT de curta duração (1h) + refresh token. RLS no Supabase. Secrets criptografados (AES-256). |
| Disponibilidade | SLA 99.5% (uptime mensal). Graceful shutdown. Health check endpoint. |
| Observabilidade | Logs estruturados (Pino). Rastreamento de erros (Sentry). Métricas (Prometheus opcional). |
| Conformidade | LGPD: consentimento de contatos, direito ao esquecimento, anonimização de dados. |
| Testabilidade | Cobertura mínima: 70% backend (Jest), 60% frontend (Jasmine). |
| Acessibilidade | Frontend WCAG 2.1 nível AA. |
| Mobile-first | Frontend responsivo (Angular Material / Tailwind). PWA support. |

---

## 7. Planos e Limites (SaaS)

| Recurso | Free | Pro / Enterprise |
|---|---|---|
| Instâncias WhatsApp | 1 | 5 |
| Mensagens/mês | 1.000 | 30.000 |
| Fluxos ativos | 3 | 20 |
| Campanhas/mês | 2 | 20 |
| Usuários/conta | 1 | 10 |
| Integrações webhook | — | 5 |
| IA (respostas/mês) | — | 2.000 |
| Retenção de dados | 30 dias | 180 dias |
| Suporte | Community | E-mail/Chat |

---

## 8. Critérios de Aceite — MVP

1. Usuário consegue criar conta, fazer login e acessar o dashboard.
2. Usuário consegue conectar uma instância WhatsApp via QR Code.
3. Usuário consegue criar um fluxo com pelo menos 5 tipos de nó e publicá-lo.
4. Bot responde automaticamente mensagens recebidas seguindo o fluxo publicado.
5. Usuário consegue enviar uma campanha para uma lista de até 100 contatos.
6. Inbox exibe conversas em tempo real e permite resposta manual.
7. Dashboard mostra métricas básicas (mensagens enviadas/recebidas nas últimas 24h).
8. Sistema passa em 70% dos testes automatizados.

---

## 9. Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| Bloqueio de número pelo WhatsApp | Implementar rate limiting, intervalos aleatórios e warm-up de instância. Documentar boas práticas ao usuário. |
| Limite de tokens da API Groq gratuita | Implementar cache de respostas similares. Permitir fallback com Ollama local. Monitorar consumo por tenant. |
| Escalabilidade do Supabase Free | Projetar para migração fácil ao plano pago. Usar índices otimizados. Paginação em todas as listagens. |
| Segurança de chaves da Evolution API | Criptografar com AES-256 no banco. Nunca expor no frontend. Renovação periódica. |
| LGPD / privacidade dos contatos | Implementar consentimento explícito, endpoint de opt-out, retenção configurável e deleção por solicitação. |

---

_WhatFlow — Documento confidencial para uso interno · Versão 1.0 · Junho 2025_
