import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  API_PREFIX: z.string().default('/v1'),

  DATABASE_URL: z.string(),
  DIRECT_URL: z.string().optional(),

  SUPABASE_URL: z.string(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
  SUPABASE_JWT_SECRET: z.string(),

  EVOLUTION_API_URL: z.string(),
  EVOLUTION_API_KEY: z.string(),
  EVOLUTION_WEBHOOK_SECRET: z.string().default(''),
  // Base pública da API que a Evolution usará para enviar webhooks.
  // Ex.: http://api:3000/v1 (no compose) ou a URL pública/túnel. Vazio = não registra webhook.
  WEBHOOK_BASE_URL: z.string().default(''),

  // Provedor de IA padrão (switch transparente). Pode ser sobrescrito por chamada.
  AI_PROVIDER: z.enum(['groq', 'ollama']).default('groq'),
  // Timeout (ms) aplicado às chamadas HTTP de IA. Override por chamada possível.
  AI_TIMEOUT_MS: z.coerce.number().default(30_000),
  // Rate limit de IA: máx. de chamadas (que vão ao provedor) por minuto, por provedor.
  // Default 30 = free tier da Groq (30 req/min). Hits de cache NÃO contam.
  AI_RATE_LIMIT_PER_MIN: z.coerce.number().default(30),
  // Cache de respostas de IA: liga/desliga e TTL (ms).
  AI_CACHE_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform(v => v === 'true'),
  AI_CACHE_TTL_MS: z.coerce.number().default(300_000),
  GROQ_API_KEY: z.string().default(''),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
  OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),
  OLLAMA_DEFAULT_MODEL: z.string().default('mistral'),
  AI_ENCRYPTION_KEY: z.string().min(32),

  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_PASSWORD: z.string().default(''),

  JWT_SECRET: z.string(),
  CORS_ORIGINS: z.string().default('http://localhost:4200'),
  LOG_LEVEL: z.string().default('info'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Variáveis de ambiente inválidas:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;
