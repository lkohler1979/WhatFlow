---
description: Implementa uma tarefa específica do projeto WhatFlow. Uso: /implementar T-005. Consulta CLAUDE.md para contexto e gera o código completo da tarefa no arquivo correto.
---

O usuário passou o ID de uma tarefa (ex: T-005). Siga estes passos:

1. **Consulte CLAUDE.md** para entender o contexto do módulo relacionado à tarefa.
2. **Identifique os arquivos** que precisam ser criados/modificados com base na estrutura do monorepo.
3. **Implemente o código completo** seguindo as convenções do projeto:
   - Backend: controller → service → repository → schema (Zod) → routes
   - Frontend: component.ts → component.html → component.scss → routes
   - Sempre TypeScript strict, sem `any` explícito
   - Controllers só recebem/respondem, Services têm a lógica, Repositories acessam Prisma
4. **Mostre um resumo** do que foi criado e o próximo passo sugerido.

Referências importantes em CLAUDE.md:
- Stack e versões: seção "Stack Tecnológico"
- Estrutura de pastas: seção "Estrutura do Monorepo"
- Convenções: seção "Convenções de Código"
- Contratos de API: docs/WhatFlow_openapi.yaml
- Modelo de dados: apps/api/prisma/schema.prisma
