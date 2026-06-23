---
description: Executa o checklist completo de início do WhatFlow em 5 passos interativos — validação de wireframes, Supabase, Prisma migrate, RLS, Insomnia e scaffold do Sprint 1.
---

Execute os 5 passos abaixo em sequência. Após cada passo mostre o resultado, marque como concluído ✅ e confirme antes de avançar.

```
╔══════════════════════════════════════════════════════╗
║   WhatFlow — /executar_inicio                        ║
║   5 passos para sair do zero ao Sprint 1 rodando     ║
╚══════════════════════════════════════════════════════╝
```

---

## PASSO 1 — Validar Wireframes ✦

Instrua o usuário a abrir o arquivo:
```
docs/WhatFlow_Wireframes.html
```
Abra no navegador (duplo clique no arquivo).

Mostre este checklist:
```
WIREFRAMES — Checklist UX

Dashboard
  [ ] KPIs fazem sentido para o negócio?
  [ ] Gráfico de mensagens está claro?
  [ ] Status das instâncias visível?

Inbox
  [ ] Layout 3 colunas funciona bem?
  [ ] Toggle Bot ↔ Humano está óbvio?
  [ ] Painel do contato tem info suficiente?

Flow Builder
  [ ] Paleta de nós organizada e clara?
  [ ] Canvas com exemplo é intuitivo?
  [ ] Painel de propriedades completo?
```

Peça confirmação: "Wireframes aprovados? Avanço para o Passo 2 (Supabase)?"

---

## PASSO 2 — Criar Projeto no Supabase ✦

```
1. Acesse: https://supabase.com/dashboard
2. Clique "New Project" → configure:
   - Name:     whatflow-dev
   - Region:   South America (São Paulo) sa-east-1
   - Plan:     Free
3. Aguarde ~2 min até ficar ativo
4. Acesse: Settings → API → copie:
   ┌────────────────────────────────────────┐
   │ Project URL        → SUPABASE_URL      │
   │ anon public key    → SUPABASE_ANON_KEY │
   │ service_role key   → SERVICE_ROLE_KEY  │
   │ JWT Secret         → SUPABASE_JWT_SECRET│
   └────────────────────────────────────────┘
5. Acesse: Settings → Database → Connection String
   Cole em DATABASE_URL e DIRECT_URL no .env
```

Execute no terminal do projeto:
```bash
cp .env.example .env
# Edite o .env com as credenciais do Supabase
```

Confirme: "Supabase configurado e .env preenchido? Avanço para o Passo 3?"

---

## PASSO 3 — Executar schema Prisma ✦

Execute em sequência:
```bash
# Instalar dependências
npm install

# Verificar conexão
npx prisma db pull --schema=apps/api/prisma/schema.prisma

# Rodar migration inicial (cria as 14 tabelas)
npx prisma migrate dev \
  --name "init_whatflow_schema" \
  --schema=apps/api/prisma/schema.prisma

# Gerar Prisma Client tipado
npx prisma generate --schema=apps/api/prisma/schema.prisma
```

Confirme no Supabase Studio que as tabelas foram criadas:
`tenants, users, instances, flows, contacts, conversations, messages, campaigns...`

Confirme: "Migration rodou sem erros? Avanço para o Passo 4 (RLS)?"

---

## PASSO 4 — Aplicar RLS no Supabase ✦

```
1. Acesse: Supabase Dashboard → SQL Editor
2. Clique "New query"
3. Abra o arquivo: docs/WhatFlow_supabase_rls.sql
4. Cole TODO o conteúdo no editor
5. Clique "Run" (Ctrl+Enter)
6. Verifique: Authentication → Policies
   Devem aparecer ~30 policies nas tabelas
```

Verificação rápida (cole no SQL Editor):
```sql
SELECT tablename, COUNT(*) as policies
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
-- Esperado: ~18 tabelas com policies
```

Confirme: "RLS aplicado com sucesso? Avanço para o Passo 5?"

---

## PASSO 5 — Insomnia + Iniciar Sprint 1 ✦

### 5a — Importar OpenAPI no Insomnia
```
1. Abra Insomnia (https://insomnia.rest se não tiver)
2. Create → Import → selecione: docs/WhatFlow_openapi.yaml
3. Crie Environment "Development":
   base_url = http://localhost:3000/v1
   token    = (preencher após implementar login)
```

### 5b — Subir ambiente de desenvolvimento
```bash
# Subir Redis
docker compose up -d redis

# Verificar saúde
docker compose ps

# Iniciar API em modo dev
npm run dev
```

Acesse: http://localhost:3000/v1/health
Deve retornar: `{ "status": "ok" }`

### 5c — Próximas tarefas (Sprint 1)
```
Execute em sequência com o Claude Code:

  /implementar T-003  → GitHub Actions CI/CD
  /implementar T-004  → Prisma seed + Supabase Auth config
  /implementar T-005  → auth.controller + auth.service + auth.routes
  /implementar T-006  → Testes de isolamento RLS
  /implementar T-007  → Angular AuthModule completo
```

---

## Sumário Final

```
╔══════════════════════════════════════════════════════╗
║   ✅ /executar_inicio concluído!                     ║
╠══════════════════════════════════════════════════════╣
║  ✅ Passo 1 — Wireframes validados                   ║
║  ✅ Passo 2 — Supabase criado + .env configurado     ║
║  ✅ Passo 3 — Schema Prisma migrado (14 tabelas)     ║
║  ✅ Passo 4 — RLS aplicado (~30 policies)            ║
║  ✅ Passo 5 — Insomnia + Redis + API health OK       ║
║                                                      ║
║  🚀 Sprint 1 ativo — próximo: /implementar T-003     ║
╚══════════════════════════════════════════════════════╝
```
