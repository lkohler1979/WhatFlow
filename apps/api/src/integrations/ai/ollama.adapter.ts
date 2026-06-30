import axios, { AxiosInstance, AxiosError } from 'axios';
import { config } from '@core/config.js';
import { logger } from '@core/logger.js';
import { AppError } from '@core/errors.js';
import type { AiAdapter, AiChatOptions, AiMessage, AiResponse } from './ai.interface.js';

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 300;

/** Falha temporária = erro de rede (sem response) ou status 5xx. */
function isTransient(err: unknown): boolean {
  const ax = err as AxiosError;
  if (!ax || !ax.response) return true;
  const status = ax.response.status;
  return status >= 500 && status <= 599;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function toAppError(err: unknown): AppError {
  const ax = err as AxiosError;
  const status = ax?.response?.status;
  return new AppError(
    `Ollama: falha ao gerar resposta${status ? ` (HTTP ${status})` : ''}`,
    status && status >= 400 && status <= 599 ? status : 502,
    'AI_PROVIDER_ERROR',
  );
}

let _client: AxiosInstance | null = null;

function buildClient(baseURL: string): AxiosInstance {
  const client = axios.create({
    baseURL,
    headers: { 'Content-Type': 'application/json' },
    timeout: config.AI_TIMEOUT_MS,
  });
  client.interceptors.response.use(
    res => res,
    err => {
      logger.error({ err: err?.response?.data, url: err?.config?.url }, 'Ollama API error');
      return Promise.reject(err);
    },
  );
  return client;
}

/**
 * Cliente Ollama.
 * - Sem override (config global): cliente memoizado (singleton).
 * - Com override de baseUrl por tenant (T-029): cliente por chamada, sem tocar
 *   no singleton. (Ollama não usa apiKey.)
 */
function getOllamaClient(opts: AiChatOptions): AxiosInstance {
  if (opts.baseUrl) return buildClient(opts.baseUrl);
  if (!_client) _client = buildClient(config.OLLAMA_BASE_URL);
  return _client;
}

interface OllamaChatResponse {
  message?: { content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
}

/**
 * Adaptador do Ollama local. POST /api/chat com stream:false. Sem auth.
 * Retry em rede/5xx; 4xx viram AppError sem repetição.
 */
export const ollamaAdapter: AiAdapter = {
  provider: 'ollama',

  async chat(messages: AiMessage[], opts: AiChatOptions = {}): Promise<AiResponse> {
    const client = getOllamaClient(opts);
    const model = opts.model ?? config.OLLAMA_DEFAULT_MODEL;
    const payload: Record<string, unknown> = {
      model,
      messages,
      stream: false,
    };
    const options: Record<string, unknown> = {};
    if (opts.temperature != null) options.temperature = opts.temperature;
    if (opts.maxTokens != null) options.num_predict = opts.maxTokens;
    if (Object.keys(options).length > 0) payload.options = options;

    const started = Date.now();
    let lastErr: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const { data } = await client.post<OllamaChatResponse>('/api/chat', payload, {
          timeout: opts.timeoutMs ?? config.AI_TIMEOUT_MS,
        });
        const content = data.message?.content ?? '';
        const promptTokens = data.prompt_eval_count;
        const completionTokens = data.eval_count;
        const totalTokens =
          promptTokens != null || completionTokens != null
            ? (promptTokens ?? 0) + (completionTokens ?? 0)
            : undefined;
        return {
          content,
          tokens: totalTokens ?? 0,
          latencyMs: Date.now() - started,
          usage: totalTokens != null ? { promptTokens, completionTokens, totalTokens } : undefined,
        };
      } catch (err) {
        lastErr = err;
        if (!isTransient(err) || attempt === MAX_ATTEMPTS) break;
        const delay = BASE_DELAY_MS * attempt;
        logger.warn({ attempt, delay }, 'Ollama: retry após falha temporária');
        await sleep(delay);
      }
    }
    throw toAppError(lastErr);
  },
};
