import { config } from '@core/config.js';
import { AppError } from '@core/errors.js';
import { logger } from '@core/logger.js';
import type { AiAdapter, AiChatOptions, AiMessage, AiResponse } from './ai.interface.js';
import { groqAdapter } from './groq.adapter.js';
import { ollamaAdapter } from './ollama.adapter.js';

export type AiProviderName = 'groq' | 'ollama';

const ADAPTERS: Record<AiProviderName, AiAdapter> = {
  groq: groqAdapter,
  ollama: ollamaAdapter,
};

/** Opções de geração + escolha explícita de provedor (switch transparente). */
export interface GenerateOptions extends AiChatOptions {
  /** Sobrescreve o provedor default (config.AI_PROVIDER) apenas nesta chamada. */
  provider?: AiProviderName;
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

  /** Gera uma resposta a partir do histórico de mensagens. */
  async generate(messages: AiMessage[], opts: GenerateOptions = {}): Promise<AiResponse> {
    const { provider, ...chatOpts } = opts;
    const adapter = resolveAdapter(provider);
    logger.info(
      { provider: adapter.provider, model: chatOpts.model, messages: messages.length },
      'AiService: gerando resposta',
    );
    return adapter.chat(messages, chatOpts);
  },
};
