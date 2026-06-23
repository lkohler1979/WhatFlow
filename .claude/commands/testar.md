---
description: Roda os testes do projeto e exibe um relatório de cobertura. Uso: /testar (todos) ou /testar api (só backend) ou /testar web (só frontend).
---

Execute os testes conforme o escopo solicitado:

**Todos:**
```bash
npm run test
```

**Só backend (api):**
```bash
cd apps/api && npm run test:coverage
```

**Só frontend (web):**
```bash
cd apps/web && npm test
```

Após executar, analise a saída e mostre:
1. Quantos testes passaram / falharam
2. Cobertura atual vs meta (backend ≥70%, frontend ≥60%)
3. Se houver falhas, mostre o erro e sugira a correção

Se a cobertura estiver abaixo da meta, sugira quais arquivos precisam de testes adicionais baseado nos módulos mais críticos (auth, flow-engine, campaigns).
