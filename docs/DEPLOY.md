# Deploy do WhatFlow — VPS Ubuntu + Cloudflare

Stack de produção em um único host com Docker Compose, atrás da Cloudflare.
Topologia: **Cloudflare (TLS na borda) → nginx (:80/:443, serve o SPA + proxy) →
api / redis / evolution / bull-board (internos)**.

Arquivos: [`docker-compose.prod.yml`](../docker-compose.prod.yml),
[`apps/api/Dockerfile.prod`](../apps/api/Dockerfile.prod),
[`apps/web/Dockerfile.prod`](../apps/web/Dockerfile.prod),
[`nginx/whatflow.conf`](../nginx/whatflow.conf), [`.env.prod.example`](../.env.prod.example).

---

## 1. Pré-requisitos

- VPS Ubuntu 22.04+ com IP público, portas **80** e **443** liberadas.
- Domínio gerenciado pela **Cloudflare**.
- Projeto **Supabase** (banco + auth) e, se for usar IA, uma **GROQ_API_KEY**.

## 2. Instalar Docker no VPS

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker   # usar docker sem sudo
docker --version && docker compose version
```

## 3. Obter o código e configurar o ambiente

```bash
git clone <repo> whatflow && cd whatflow
cp .env.prod.example .env.prod
nano .env.prod   # preencha Supabase, EVOLUTION_API_KEY, GROQ, segredos, CORS_ORIGINS
```

`CORS_ORIGINS` = a URL pública (ex.: `https://app.seu-dominio.com`).
Os valores do frontend (`SUPABASE_PUBLIC_URL`/`SUPABASE_PUBLIC_ANON_KEY`) entram no
**build** do Angular (build args) — por isso o build do `nginx` lê do `.env.prod`.

## 4. Cloudflare (DNS + TLS)

1. **DNS** → registro `A` `app` → IP do VPS, **proxy ligado** (nuvem laranja).
2. **SSL/TLS → Overview** → modo **Full (strict)** (recomendado).
3. **SSL/TLS → Origin Server → Create Certificate** → salve no VPS:
   ```bash
   mkdir -p nginx/certs
   nano nginx/certs/origin.pem   # cole o certificado
   nano nginx/certs/origin.key   # cole a chave privada
   ```
4. Habilite o bloco **TLS** no `nginx/whatflow.conf` (instruções no fim do arquivo)
   e troque o `listen 80` por redirect → https.

> **Atalho para o 1º teste:** com o `nginx/whatflow.conf` padrão (só `:80`) e a
> Cloudflare em **Flexible**, já sobe e responde por HTTPS na borda. Migre para
> **Full (strict)** + Origin Cert assim que validar.
>
> **Alternativa sem abrir portas:** Cloudflare Tunnel (`cloudflared`) — adicione um
> serviço `cloudflared` apontando para `nginx:80` e use um Tunnel token. Não exige
> IP público nem cert no origin.

## 5. Subir

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps        # todos healthy?
docker compose -f docker-compose.prod.yml logs -f api
```

Validações:
- `https://app.seu-dominio.com` carrega o SPA.
- `https://app.seu-dominio.com/health` → `{"status":"ok"}`.
- `https://app.seu-dominio.com/docs` → Swagger (se habilitado no backend).
- Login funciona; o realtime (Socket.io) conecta (Inbox atualiza sem refresh).

As migrations do Prisma rodam automaticamente no start da API
(`prisma migrate deploy`), contra o Supabase do `.env.prod`.

## 6. Deploy de atualização (sem downtime perceptível)

```bash
git pull
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

O Compose recria só os serviços alterados; o `nginx` continua atendendo enquanto a
`api` reinicia (segundos). Para zero-downtime real da API, ver "blue/green" abaixo.

## 7. Rollback (< 2 min)

Como produção sobe por imagens versionadas (`whatflow-api:prod` / `whatflow-web:prod`),
marque uma tag a cada release e volte para a anterior:

```bash
# antes de cada deploy, versione a imagem atual:
docker tag whatflow-api:prod whatflow-api:prev
docker tag whatflow-web:prod whatflow-web:prev

# rollback: aponte o compose para :prev (ou recrie a partir do git anterior)
git checkout <commit-anterior>
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

Alternativa mais rápida: mantenha as imagens `:prev` e suba-as direto (sem rebuild).

## 8. Operação

```bash
docker compose -f docker-compose.prod.yml logs -f [serviço]   # logs
docker compose -f docker-compose.prod.yml restart api          # reiniciar
docker compose -f docker-compose.prod.yml down                 # parar tudo
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy --schema=prisma/schema.prisma
```

Bull-Board (filas) e Evolution ficam **internos**. Para acessá-los, exponha atrás do
nginx com autenticação (ex.: `location /admin/queues`) — não publique direto.

## 9. Checklist de segurança (antes de produção)

- [ ] Rotacionar segredos que passaram por chat/disco (ver [PENDENCIA.MD](../PENDENCIA.MD)):
      `SUPABASE_SERVICE_ROLE_KEY` (P-02), senha do banco (P-03),
      `AUTHENTICATION_API_KEY` da Evolution (P-15), `GROQ_API_KEY` (P-20).
- [ ] `.env.prod` fora do git, permissões `chmod 600`.
- [ ] Cloudflare em **Full (strict)** com Origin Cert.
- [ ] Firewall do VPS (ufw): permitir só 22/80/443.
- [ ] Trocar `EVOLUTION_PG_PASSWORD` do default.
