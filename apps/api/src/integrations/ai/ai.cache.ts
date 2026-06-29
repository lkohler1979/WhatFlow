import { createHash } from 'node:crypto';
import { config } from '@core/config.js';
import { logger } from '@core/logger.js';
import { AppError } from '@core/errors.js';
import type { AiMessage, AiResponse } from './ai.interface.js';

/**
 * Cache de respostas e rate limiting de IA — implementação IN-MEMORY.
 *
 * Por que in-memory (e não Redis)?
 *  - MVP: simples, sem dependência externa no caminho crítico e fácil de testar
 *    com fake timers (Jest). Redis daria distribuição entre instâncias, mas exigiria
 *    fallback best-effort se cair; para um único processo de API o Map basta.
 *  - O TTL é varrido de forma preguiçosa (lazy) na leitura — sem timers de fundo.
 *
 * Cache: chave = hash estável de (provider, model, messages, temperature, maxTokens);
 *        valor = AiResponse. Hit → retorna sem chamar o provedor e SEM consumir cota.
 *
 * Rate limit: janela fixa de 60s por provedor (e por tenant, se informado). Ao
 *        estourar, lança AppError(429, 'AI_RATE_LIMIT') — rejeitar é mais previsível
 *        que esperar para o MVP. Apenas chamadas que vão ao provedor contam.
 */

const WINDOW_MS = 60_000;

interface CacheEntry {
  value: AiResponse;
  expiresAt: number;
}

interface RateBucket {
  count: number;
  windowStart: number;
}

/** Parâmetros que tornam uma resposta de IA reproduzível (entram no hash). */
export interface AiCacheKeyInput {
  provider: string;
  model: string;
  messages: AiMessage[];
  temperature?: number;
  maxTokens?: number;
}

/** Snapshot de consumo, exposto via aiService.getUsage(). */
export interface AiUsageStats {
  /** Total de chamadas a generate() (inclui hits de cache). */
  totalCalls: number;
  /** Quantas resolveram via cache (não foram ao provedor). */
  cacheHits: number;
  /** Quantas foram efetivamente ao provedor. */
  cacheMisses: number;
  /** Tokens acumulados das respostas que foram ao provedor. */
  totalTokens: number;
  /** Chamadas ao provedor no minuto corrente, por chave de rate limit. */
  currentMinute: Record<string, number>;
}

const cacheStore = new Map<string, CacheEntry>();
const rateBuckets = new Map<string, RateBucket>();

let totalCalls = 0;
let cacheHits = 0;
let cacheMisses = 0;
let totalTokens = 0;

/** Hash SHA-256 estável dos parâmetros que definem a resposta. */
export function cacheKey(input: AiCacheKeyInput): string {
  const canonical = JSON.stringify({
    provider: input.provider,
    model: input.model,
    temperature: input.temperature ?? null,
    maxTokens: input.maxTokens ?? null,
    messages: input.messages.map(m => ({ role: m.role, content: m.content })),
  });
  return createHash('sha256').update(canonical).digest('hex');
}

/** Lê do cache (respeitando TTL). Retorna undefined em miss/expirado/desligado. */
export function cacheGet(key: string): AiResponse | undefined {
  if (!config.AI_CACHE_ENABLED) return undefined;
  const entry = cacheStore.get(key);
  if (!entry) return undefined;
  if (Date.now() >= entry.expiresAt) {
    cacheStore.delete(key);
    return undefined;
  }
  return entry.value;
}

/** Grava no cache com TTL de config.AI_CACHE_TTL_MS. No-op se desligado. */
export function cacheSet(key: string, value: AiResponse): void {
  if (!config.AI_CACHE_ENABLED) return;
  cacheStore.set(key, { value, expiresAt: Date.now() + config.AI_CACHE_TTL_MS });
}

/**
 * Verifica e contabiliza o rate limit (janela fixa de 60s). Só deve ser chamado
 * para requisições que de fato irão ao provedor (cache miss). Lança 429 ao estourar.
 */
export function enforceRateLimit(scope: string): void {
  const now = Date.now();
  const bucket = rateBuckets.get(scope);
  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    rateBuckets.set(scope, { count: 1, windowStart: now });
    return;
  }
  if (bucket.count >= config.AI_RATE_LIMIT_PER_MIN) {
    logger.warn(
      { scope, limit: config.AI_RATE_LIMIT_PER_MIN, count: bucket.count },
      'AiService: rate limit excedido',
    );
    throw new AppError(
      `IA: limite de ${config.AI_RATE_LIMIT_PER_MIN} req/min excedido`,
      429,
      'AI_RATE_LIMIT',
    );
  }
  bucket.count += 1;
}

/** Registra estatísticas de uma chamada. */
export function recordHit(): void {
  totalCalls += 1;
  cacheHits += 1;
}

export function recordMiss(tokens: number): void {
  totalCalls += 1;
  cacheMisses += 1;
  totalTokens += tokens;
}

/** Snapshot de consumo (chamadas, hits, tokens, contagem no minuto atual). */
export function getUsage(): AiUsageStats {
  const now = Date.now();
  const currentMinute: Record<string, number> = {};
  for (const [scope, bucket] of rateBuckets) {
    if (now - bucket.windowStart < WINDOW_MS) currentMinute[scope] = bucket.count;
  }
  return { totalCalls, cacheHits, cacheMisses, totalTokens, currentMinute };
}

/** Zera cache, buckets e contadores — útil para testes e diagnóstico. */
export function resetUsage(): void {
  cacheStore.clear();
  rateBuckets.clear();
  totalCalls = 0;
  cacheHits = 0;
  cacheMisses = 0;
  totalTokens = 0;
}
