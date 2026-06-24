---
description: Mostra o status atual do sprint — quais tarefas foram concluídas, estão em andamento e pendentes. Analisa os arquivos do projeto para inferir o progresso real.
---

Analise o estado atual do projeto e mostre o progresso do Sprint 1:

1. **Verifique os arquivos implementados** — use `find apps/ -type f -name "*.ts" ! -empty` para identificar arquivos com conteúdo real vs arquivos vazios (placeholder).

2. **Compare com as tarefas do Sprint 1** definidas em CLAUDE.md:
   - T-001: Monorepo (package.json, tsconfig.base.json, .editorconfig)
   - T-002: Docker Compose (docker-compose.yml, Dockerfiles)
   - T-003: CI/CD (.github/workflows/ci.yml)
   - T-004: Supabase + Prisma (schema.prisma + migrations/)
   - T-005: Auth backend (auth.controller.ts, auth.service.ts, auth.routes.ts)
   - T-006: RLS (migrations com políticas aplicadas)
   - T-007: Angular Auth (login.component.ts, auth.guard.ts, auth.service.ts)

3. **Exiba o resultado** neste formato:
```
Sprint 1 — Foundation & Infrastructure
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ T-001 Monorepo setup
✅ T-002 Docker Compose
✅ T-003 CI/CD GitHub Actions
⏳ T-004 Supabase + Prisma (migration pendente)
🔲 T-005 Auth backend
🔲 T-006 RLS policies
🔲 T-007 Angular AuthModule

Progresso: 3/7 tarefas (43%)
Próxima ação: /implementar T-004
```
