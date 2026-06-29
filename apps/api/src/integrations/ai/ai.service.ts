import { config } from '@core/config.js';
import { AppError } from '@core/errors.js';
import { logger } from '@core/logger.js';
import type { AiAdapter, AiChatOptions, AiMessage, AiResponse } from './ai.interface.js';
import { groqAdapter } from './groq.adapter.js';
import { ollamaAdapter } from './ollama.adapter.js';
import {
  cacheGet,
  cacheKey,
  cacheSet,
  enforceRateLimit,
  getUsage,
  recordHit,
  recordMiss,
  resetUsage,
  type AiUsageStats,
} from './ai.cache.js';

export type AiProviderName = 'groq' | 'ollama';

const ADAPTERS: Record<AiProviderName, AiAdapter> = {
  groq: groqAdapter,
  ollama: ollamaAdapter,
};

/** Opções de geração + escolha explícita de provedor (switch transparente). */
export interface GenerateOptions extends AiChatOptions {
  /** Sobrescreve o provedor default (config.AI_PROVIDER) apenas nesta chamada. */
  provider?: AiProviderName;
  /** Tenant para isolar a cota de rate limit (opcional). */
  tenantId?: string;
}

function resolveAdapter(provider?: AiProviderName): AiAdapter {
  const name = provider ?? (config.AI_PROVIDER as AiProviderName);
  const adapter = ADAPTERS[name];
  if (!adapter) {
    throw new AppError(`Provedor de IA desconhecido: "${name}"`, 400, 'AI_PROVIDER_ERROR');
  }
  return adapter;
}

/**
 * Fachada de IA. Mesmo método `generate` funciona igual para Groq e Ollama —
 * o provedor é escolhido por `config.AI_PROVIDER` ou por `opts.provider`.
 * Timeout vem de `config.AI_TIMEOUT_MS`, com override por chamada (`opts.timeoutMs`).
 */
export const aiService = {
  /** Provedor default atual (config). */
  get defaultProvider(): AiProviderName {
    return config.AI_PROVIDER as AiProviderName;
  },

  /**
   * Gera uma resposta a partir do histórico de mensagens.
   *
   * Fluxo interno (assinatura pública inalterada): cache-check → rate-limit-check →
   * adapter → grava cache + contadores. Hit de cache retorna sem ir ao provedor e
   * sem consumir cota de rate limit.
   */
  async generate(messages: AiMessage[], opts: GenerateOptions = {}): Promise<AiResponse> {
    const { provider, tenantId, ...chatOpts } = opts;
    const adapter = resolveAdapter(provider);
    const model = chatOpts.model ?? defaultModel(adapter.provider as AiProviderName);

    const key = cacheKey({
      provider: adapter.provider,
      model,
      messages,
      temperature: chatOpts.temperature,
      maxTokens: chatOpts.maxTokens,
    });

    const cached = cacheGet(key);
    if (cached) {
      recordHit();
      logger.info(
        { provider: adapter.provider, model, cache: 'hit', usage: getUsage() },
        'AiService: resposta do cache',
      );
      return cached;
    }

    // Apenas cache miss consome cota. Escopo por provedor (e por tenant, se informado).
    const scope = tenantId ? `${adapter.provider}:${tenantId}` : adapter.provider;
    enforceRateLimit(scope);

    logger.info(
      { provider: adapter.provider, model, messages: messages.length, cache: 'miss' },
      'AiService: gerando resposta',
    );

    const res = await adapter.chat(messages, chatOpts);
    cacheSet(key, res);
    recordMiss(res.tokens);
    logger.info(
      { provider: adapter.provider, model, tokens: res.tokens, usage: getUsage() },
      'AiService: consumo de IA',
    );
    return res;
  },

  /** Snapshot de consumo (chamadas, hits de cache, tokens, contagem no minuto atual). */
  getUsage(): AiUsageStats {
    return getUsage();
  },

  /** Zera cache, buckets de rate limit e contadores (testes/diagnóstico). */
  resetUsage(): void {
    resetUsage();
  },
};

/** Modelo default por provedor (entra no hash do cache de forma estável). */
function defaultModel(provider: AiProviderName): string {
  return provider === 'ollama' ? config.OLLAMA_DEFAULT_MODEL : config.GROQ_MODEL;
}
