import type { AxiosError } from 'axios';
import { getEvolutionClient } from './evolution-api.client.js';
import { logger } from '@core/logger.js';
import { AppError } from '@core/errors.js';
import type {
  EvolutionInstance,
  EvolutionSendTextPayload,
  EvolutionSendMediaPayload,
} from './evolution-api.types.js';

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

/** Executa `fn` com retry/backoff em falhas temporárias. Não repete em 4xx. */
async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransient(err) || attempt === MAX_ATTEMPTS) break;
      const delay = BASE_DELAY_MS * attempt;
      logger.warn({ label, attempt, delay }, 'Evolution API: retry após falha temporária');
      await sleep(delay);
    }
  }
  const ax = lastErr as AxiosError;
  const status = ax?.response?.status;
  throw new AppError(
    `Evolution API falhou em "${label}"`,
    status && status >= 400 && status <= 599 ? status : 502,
    'EVOLUTION_API_ERROR',
  );
}

export interface CreateInstanceOptions {
  qrcode?: boolean;
  webhookUrl?: string;
  webhookEvents?: string[];
}

/**
 * Adaptador da Evolution API v2. Toda chamada HTTP passa por `withRetry`.
 * Endpoints conforme contrato em CLAUDE.md.
 */
export const evolutionApiService = {
  /** POST /instance/create */
  createInstance(
    instanceName: string,
    opts: CreateInstanceOptions = {},
  ): Promise<EvolutionInstance> {
    const client = getEvolutionClient();
    return withRetry('createInstance', async () => {
      const body: Record<string, unknown> = {
        instanceName,
        qrcode: opts.qrcode ?? true,
      };
      if (opts.webhookUrl) {
        body.webhook = { url: opts.webhookUrl, events: opts.webhookEvents ?? [] };
      }
      const { data } = await client.post('/instance/create', body);
      return data as EvolutionInstance;
    });
  },

  /** GET /instance/connectionState/{key} */
  getConnectionState(key: string): Promise<EvolutionInstance> {
    const client = getEvolutionClient();
    return withRetry('getConnectionState', async () => {
      const { data } = await client.get(`/instance/connectionState/${key}`);
      return data as EvolutionInstance;
    });
  },

  /** GET /instance/connect/{key} — retorna QR Code */
  connect(key: string): Promise<EvolutionInstance> {
    const client = getEvolutionClient();
    return withRetry('connect', async () => {
      const { data } = await client.get(`/instance/connect/${key}`);
      return data as EvolutionInstance;
    });
  },

  /** POST /message/sendText/{key} */
  sendText(key: string, payload: EvolutionSendTextPayload): Promise<unknown> {
    const client = getEvolutionClient();
    return withRetry('sendText', async () => {
      const { data } = await client.post(`/message/sendText/${key}`, payload);
      return data;
    });
  },

  /** POST /message/sendMedia/{key} */
  sendMedia(key: string, payload: EvolutionSendMediaPayload): Promise<unknown> {
    const client = getEvolutionClient();
    return withRetry('sendMedia', async () => {
      const { data } = await client.post(`/message/sendMedia/${key}`, payload);
      return data;
    });
  },

  /** POST /webhook/set/{key} */
  setWebhook(key: string, url: string, events: string[]): Promise<unknown> {
    const client = getEvolutionClient();
    return withRetry('setWebhook', async () => {
      const { data } = await client.post(`/webhook/set/${key}`, {
        webhook: { enabled: true, url, events },
      });
      return data;
    });
  },
};
