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

  GROQ_API_KEY: z.string().default(''),
  GROQ_MODEL: z.string().default('llama-3.1-70b-versatile'),
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
