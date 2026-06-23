---
name: executar-inicio
description: >
  Executa o checklist completo de início do projeto WhatFlow em sequência interativa.
  Use quando o usuário digitar /executar_inicio ou pedir para "iniciar o projeto",
  "começar o desenvolvimento", "executar o setup inicial", "rodar o checklist de início".
  Guia passo a passo por: validação dos wireframes, criação do projeto no Supabase,
  execução do schema Prisma, aplicação das políticas RLS, configuração do Insomnia
  e início do código do Sprint 1 (T-001 até T-007).
---

# Skill: /executar_inicio

Quando acionado, execute os 5 passos abaixo **em sequência**, um por vez.
Após cada passo, mostre o resultado, marque como concluído ✅ e pergunte se pode avançar — exceto nos passos totalmente automatizáveis (T-001 a T-007), onde execute sem parar.

Antes de começar, exiba este cabeçalho:

```
╔══════════════════════════════════════════════════════╗
║   WhatFlow — /executar_inicio                        ║
║   5 passos para sair do zero ao Sprint 1 rodando     ║
╚══════════════════════════════════════════════════════╝
```

---

## PASSO 1 — Validar Wireframes ✦ (manual — requer sua ação)

Instrua o usuário a abrir o arquivo de wireframes:

```
📂 Abra o arquivo:
   WhatFlow_Wireframes.html
   (disponível na pasta de outputs do Claude)
```

Mostre este checklist para revisão:

```
WIREFRAMES — Checklist de Validação UX

Dashboard
  [ ] KPIs fazem sentido para o negócio?
  [ ] Gráfico de volume de mensagens está claro?
  [ ] Status das instâncias é visível de imediato?

Inbox (Caixa de Entrada)
  [ ] 3 colunas funcionam bem na tela?
  [ ] Toggle Bot ↔ Humano está em lugar óbvio?
  [ ] Painel do contato (coluna 3) tem informações úteis?

Flow Builder (Editor de Fluxos)
  [ ] Paleta de nós está acessível e clara?
  [ ] Canvas com o fluxo de exemplo é intuitivo?
  [ ] Painel de propriedades do nó está completo?
```

Peça ao usuário confirmar: "Wireframes aprovados? Posso prosseguir para o Passo 2?"

---

## PASSO 2 — Criar Projeto no Supabase ✦ (manual — requer sua ação)

Exiba instruções claras e numeradas:

```
SUPABASE — Criação do Projeto

1. Acesse: https://supabase.com/dashboard
2. Clique em "New Project"
3. Configure:
   - Name:        whatflow-prod  (ou whatflow-dev para dev)
   - Database Password: [gere uma senha forte e SALVE]
   - Region:      South America (São Paulo) — sa-east-1
   - Plan:        Free (para começar)
4. Aguarde ~2 minutos até o projeto ficar ativo
5. Acesse: Project Settings → API
   Copie e salve:
   ┌─────────────────────────────────────────────┐
   │ Project URL:        https://[REF].supabase.co│
   │ anon public key:    eyJ...                   │
   │ service_role key:   eyJ... (⚠️ nunca expor) │
   │ JWT Secret:         (em Settings → API)      │
   └─────────────────────────────────────────────┘
6. Acesse: Project Settings → Database
   Copie a Connection String (Direct Connection — postgres://...)
```

Depois, instrua a criar o `.env` local:

```bash
# Cole as variáveis no arquivo .env do projeto:
DATABASE_URL="postgresql://postgres:[SENHA]@db.[REF].supabase.co:5432/postgres"
DIRECT_URL="postgresql://postgres:[SENHA]@db.[REF].supabase.co:5432/postgres"
SUPABASE_URL="https://[REF].supabase.co"
SUPABASE_ANON_KEY="eyJ..."
SUPABASE_SERVICE_ROLE_KEY="eyJ..."
SUPABASE_JWT_SECRET="..."
```

Peça confirmação: "Projeto Supabase criado e variáveis no .env? Posso avançar para o Passo 3?"

---

## PASSO 3 — Executar schema.prisma no Supabase ✦ (semi-automático)

Exiba os comandos em sequência:

```bash
# 3.1 — Instalar dependências (se ainda não fez)
npm install

# 3.2 — Verificar conexão com o banco
npx prisma db pull --schema=apps/api/prisma/schema.prisma

# 3.3 — Rodar a migration inicial (cria todas as 14 tabelas)
npx prisma migrate dev \
  --name "init_whatflow_schema" \
  --schema=apps/api/prisma/schema.prisma

# 3.4 — Gerar o Prisma Client tipado
npx prisma generate \
  --schema=apps/api/prisma/schema.prisma

# 3.5 — Verificar tabelas criadas no Supabase Studio:
# https://supabase.com/dashboard → Table Editor
# Tabelas esperadas: tenants, users, api_keys, instances,
# flows, flow_sessions, contacts, tags, contact_tags,
# conversation_tags, conversations, messages,
# conversation_notes, campaigns, campaign_contacts,
# ai_configs, webhooks, webhook_deliveries, audit_logs
```

Se houver erro de conexão, exiba troubleshooting:

```
❌ Erro comum: "Can't reach database server"
   → Verifique se DATABASE_URL está correto no .env
   → Confirme que o projeto Supabase está ativo (não pausado)
   → Tente trocar DATABASE_URL por DIRECT_URL temporariamente

❌ Erro: "Environment variable not found: DATABASE_URL"
   → Verifique se o arquivo .env está na raiz do projeto
   → Instale: npm install dotenv-cli
   → Execute: dotenv -- npx prisma migrate dev
```

Peça confirmação: "Migration rodou sem erros? Posso aplicar as políticas RLS?"

---

## PASSO 4 — Aplicar supabase_rls.sql ✦ (manual no Supabase Studio)

Instrua o usuário:

```
RLS — Políticas de Segurança

1. Acesse o Supabase Dashboard do seu projeto
2. Clique em "SQL Editor" no menu lateral
3. Clique em "New query"
4. Abra o arquivo: WhatFlow_supabase_rls.sql
   (disponível nos outputs do Claude)
5. Cole TODO o conteúdo no editor SQL
6. Clique em "Run" (ou Ctrl+Enter)
7. Verifique na aba "Results": deve mostrar SUCCESS
8. Confirme em Authentication → Policies que
   existem policies em todas as tabelas
```

Exiba verificação rápida pós-execução:

```sql
-- Cole este comando no SQL Editor para verificar:
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Resultado esperado: ~30+ policies listadas
```

Peça confirmação: "RLS aplicado com sucesso? Posso configurar o Insomnia?"

---

## PASSO 5 — Importar openapi.yaml no Insomnia e Iniciar Sprint 1 ✦

### 5a — Configurar Insomnia (ou Postman)

```
INSOMNIA — Importar contrato da API

1. Abra o Insomnia (https://insomnia.rest/download se não tiver)
2. Clique em "Create" → "Import"
3. Selecione o arquivo: WhatFlow_openapi.yaml
4. Nome da collection: WhatFlow API v1
5. Crie um Environment "Development":
   ┌─────────────────────────────────────┐
   │ base_url:  http://localhost:3000/v1 │
   │ token:     (preencher após login)   │
   └─────────────────────────────────────┘
6. Teste o endpoint GET /auth/me
   (deve retornar 401 por enquanto — correto!)
```

### 5b — Iniciar o código do Sprint 1

Após confirmação do usuário, execute automaticamente a criação da estrutura do monorepo:

```bash
# T-001 — Estrutura base do monorepo

mkdir -p whatflow/{apps/api/src/{modules,core,integrations,queues,middlewares},apps/api/prisma/migrations,apps/web/src/app/{core,shared,modules/{dashboard,inbox,flows,campaigns,contacts,instances,analytics,settings}},apps/web/cypress}

cd whatflow

# package.json raiz (workspaces)
cat > package.json << 'EOF'
{
  "name": "whatflow",
  "private": true,
  "workspaces": ["apps/*"],
  "scripts": {
    "dev": "concurrently \"npm run dev --workspace=apps/api\" \"npm run dev --workspace=apps/web\"",
    "lint": "npm run lint --workspaces",
    "test": "npm run test --workspaces",
    "build": "npm run build --workspaces"
  },
  "devDependencies": {
    "concurrently": "^8.2.0",
    "husky": "^9.0.0",
    "lint-staged": "^15.0.0"
  }
}
EOF

# tsconfig base
cat > tsconfig.base.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
EOF

echo "✅ T-001 — Monorepo scaffolded"
```

Depois execute a criação do `docker-compose.yml`:

```bash
# T-002 — Docker Compose

cat > docker-compose.yml << 'EOF'
version: '3.9'

services:
  api:
    build: ./apps/api
    ports: ["3000:3000"]
    env_file: .env
    depends_on: [redis]
    volumes: ["./apps/api:/app", "/app/node_modules"]
    command: npm run dev

  web:
    build: ./apps/web
    ports: ["4200:4200"]
    env_file: .env
    volumes: ["./apps/web:/app", "/app/node_modules"]
    command: npm run start

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes: ["redis_data:/data"]

  bull-board:
    image: deadly0/bull-board
    ports: ["3001:3000"]
    environment:
      REDIS_HOST: redis
      REDIS_PORT: 6379
    depends_on: [redis]

volumes:
  redis_data:
EOF

echo "✅ T-002 — Docker Compose criado"
```

Então exiba o roadmap das próximas tarefas:

```
SPRINT 1 — Próximas tarefas (execute com Claude Code):

  /implementar T-003  → Pipeline GitHub Actions (CI/CD)
  /implementar T-004  → Prisma client + seed inicial
  /implementar T-005  → Auth endpoints (register/login/refresh)
  /implementar T-006  → RLS policies + testes de isolamento
  /implementar T-007  → Frontend Angular: AuthModule + Guards

💡 Dica: use o comando /status_sprint para ver o progresso
         e /implementar <task-id> para executar cada tarefa.
```

---

## Sumário Final

Ao concluir todos os 5 passos, exiba:

```
╔══════════════════════════════════════════════════════╗
║   ✅ /executar_inicio concluído!                     ║
╠══════════════════════════════════════════════════════╣
║                                                      ║
║  ✅ Passo 1 — Wireframes validados                   ║
║  ✅ Passo 2 — Projeto Supabase criado                ║
║  ✅ Passo 3 — Schema Prisma migrado (14 tabelas)     ║
║  ✅ Passo 4 — RLS aplicado (30+ policies)            ║
║  ✅ Passo 5 — Insomnia + monorepo scaffolded         ║
║                                                      ║
║  🚀 Sprint 1 iniciado — T-001 e T-002 prontos        ║
║  📋 Próximo: /implementar T-003                      ║
╚══════════════════════════════════════════════════════╝
```
