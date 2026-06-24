---
name: contexto-projeto
description: >
  Carrega e explica o contexto completo do projeto WhatFlow. Use quando o usuário
  perguntar "o que é o WhatFlow", "qual a stack do projeto", "como é a arquitetura",
  "quais são as tarefas do sprint atual", "quais são as decisões técnicas",
  "qual é o modelo de dados", ou qualquer outra dúvida sobre o projeto em si.
  Também use quando o usuário pedir "contexto do projeto" ou "resumo do que foi feito".
---

# Skill: Contexto do Projeto WhatFlow

Quando acionado, consulte o arquivo `CLAUDE.md` na raiz do plugin
e responda a dúvida do usuário com base nele.

Se o usuário perguntou algo específico (ex: "qual a stack de IA?"),
responda diretamente sem reproduzir o arquivo inteiro.

Se o usuário quer um resumo geral, exiba:

```
WhatFlow — Visão Geral do Projeto
══════════════════════════════════

📌 O que é: Plataforma SaaS de automação WhatsApp com chatbot visual,
            campanhas em massa e IA integrada.

🛠  Stack:  Node.js 20 + Express 5 + TypeScript (API)
            Angular 17 Standalone Components (Frontend)
            Supabase PostgreSQL 15 + Auth + Realtime (Banco)
            Evolution API v2 (WhatsApp Gateway)
            Groq llama-3.1-70b — free tier (IA principal)
            BullMQ + Redis (Filas de campanha)
            Prisma ORM (Migrations)

📁 Docs:   PRD, TASKS, schema.prisma, openapi.yaml, wireframes
           → disponíveis nos outputs do Claude

🏃 Sprint: Sprint 1 — Foundation & Infrastructure
           T-001 a T-007 (Auth, Infra, Angular base)
```

Para perguntas técnicas específicas, consulte as seções relevantes do CLAUDE.md:
- Stack → seção "Stack Tecnológico"
- Estrutura de pastas → seção "Estrutura do Monorepo"
- Modelo de dados → seção "Modelo de Dados"
- Integrações → seção "Integrações externas — contratos"
- Variáveis de ambiente → seção "Variáveis de Ambiente"
- Convenções → seção "Convenções de Código"
- Decisões técnicas → seção "Decisões Arquiteturais (ADRs)"
