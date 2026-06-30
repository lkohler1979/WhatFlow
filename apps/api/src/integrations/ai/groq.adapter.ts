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

/** Mapeia erro axios → AppError claro. Sem repetição em 4xx. */
function toAppError(err: unknown): AppError {
  const ax = err as AxiosError;
  const status = ax?.response?.status;
  if (status === 429) {
    return new AppError('Groq: limite de requisições excedido', 429, 'AI_RATE_LIMIT');
  }
  if (status === 401 || status === 403) {
    return new AppError('Groq: credencial inválida ou sem permissão', status, 'AI_PROVIDER_ERROR');
  }
  return new AppError(
    `Groq: falha ao gerar resposta${status ? ` (HTTP ${status})` : ''}`,
    status && status >= 400 && status <= 599 ? status : 502,
    'AI_PROVIDER_ERROR',
  );
}

const GROQ_DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1';

let _client: AxiosInstance | null = null;

function buildClient(apiKey: string, baseURL: string): AxiosInstance {
  const client = axios.create({
    baseURL,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: config.AI_TIMEOUT_MS,
  });
  client.interceptors.response.use(
    res => res,
    err => {
      logger.error({ err: err?.response?.data, url: err?.config?.url }, 'Groq API error');
      return Promise.reject(err);
    },
  );
  return client;
}

/**
 * Cliente Groq/OpenAI-compatible.
 * - Sem override (config global): cliente memoizado (singleton).
 * - Com override de apiKey/baseUrl por tenant (T-029): cliente por chamada,
 *   sem tocar no singleton — preserva o caminho default.
 */
function getGroqClient(opts: AiChatOptions): AxiosInstance {
  if (opts.apiKey || opts.baseUrl) {
    return buildClient(opts.apiKey ?? config.GROQ_API_KEY, opts.baseUrl ?? GROQ_DEFAULT_BASE_URL);
  }
  if (!_client) _client = buildClient(config.GROQ_API_KEY, GROQ_DEFAULT_BASE_URL);
  return _client;
}

interface GroqChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

/**
 * Adaptador da Groq (formato OpenAI-compatible). POST /chat/completions.
 * Retry em rede/5xx; 4xx (401/429/...) viram AppError sem repetição.
 */
export const groqAdapter: AiAdapter = {
  provider: 'groq',

  async chat(messages: AiMessage[], opts: AiChatOptions = {}): Promise<AiResponse> {
    const client = getGroqClient(opts);
    const model = opts.model ?? config.GROQ_MODEL;
    const payload: Record<string, unknown> = {
      model,
      messages,
      temperature: opts.temperature ?? 0.7,
    };
    if (opts.maxTokens != null) payload.max_tokens = opts.maxTokens;

    const started = Date.now();
    let lastErr: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const { data } = await client.post<GroqChatResponse>('/chat/completions', payload, {
          timeout: opts.timeoutMs ?? config.AI_TIMEOUT_MS,
        });
        const content = data.choices?.[0]?.message?.content ?? '';
        const usage = data.usage;
        return {
          content,
          tokens: usage?.total_tokens ?? 0,
          latencyMs: Date.now() - started,
          usage: usage
            ? {
                promptTokens: usage.prompt_tokens,
                completionTokens: usage.completion_tokens,
                totalTokens: usage.total_tokens,
              }
            : undefined,
        };
      } catch (err) {
        lastErr = err;
        if (!isTransient(err) || attempt === MAX_ATTEMPTS) break;
        const delay = BASE_DELAY_MS * attempt;
        logger.warn({ attempt, delay }, 'Groq: retry após falha temporária');
        await sleep(delay);
      }
    }
    throw toAppError(lastErr);
  },
};
