import { createHmac } from 'node:crypto';
import type { Job } from 'bullmq';
import axios, { AxiosError, type AxiosResponse } from 'axios';
import { logger } from '@core/logger.js';
import { webhooksRepository } from '@modules/webhooks/webhooks.repository.js';
import type { Prisma, WebhookEvent } from '@prisma/client';

/** Payload enfileirado por webhooksService.dispatchEvent()/testWebhook() (T-047). */
export interface WebhookDeliveryJobData {
  webhookId: string;
  tenantId: string;
  event: WebhookEvent;
  payload: Record<string, unknown>;
  /** Quando vem de um teste, o delivery já foi pré-criado e atualizamos esse id. */
  deliveryId?: string;
}

/** Timeout do POST de saída (ms). Mantém o worker responsivo sob endpoints lentos. */
const REQUEST_TIMEOUT_MS = 10_000;
/** Limite de bytes guardado de responseBody (evita inflar a coluna Text). */
const MAX_RESPONSE_BODY = 2_000;

/**
 * Assinatura HMAC-SHA256 do corpo. O receptor recalcula
 * `HMAC_SHA256(secret, rawBody)` e compara com o header `X-WhatFlow-Signature`.
 * Formato: `sha256=<hex>`.
 */
export function signPayload(secret: string, rawBody: string): string {
  return `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
}

function truncate(value: unknown): string {
  const str = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  return str.length > MAX_RESPONSE_BODY ? str.slice(0, MAX_RESPONSE_BODY) : str;
}

/**
 * Processor da fila `webhook-delivery` (T-047).
 *
 * Fluxo: carrega o webhook, monta o corpo JSON ({ event, tenantId, timestamp,
 * data }), assina com HMAC-SHA256 (se houver secret) e faz POST na url com os
 * headers customizados + `X-WhatFlow-Signature`. Mede `durationMs` e grava o
 * resultado em `WebhookDelivery` (httpStatus, responseBody truncado,
 * attemptCount, status SUCCESS/FAILED/RETRYING).
 *
 * Retry: a fila já tem attempts:5 + backoff exponencial. Em status ≥400 ou erro
 * de rede LANÇAMOS o erro para o BullMQ re-tentar; enquanto ainda houver
 * tentativas, gravamos status RETRYING; na última, FAILED. Sucesso (2xx/3xx)
 * grava SUCCESS e resolve. O registro do delivery é best-effort: uma falha ao
 * persistir não derruba o worker nem mascara o resultado do POST.
 */
export async function webhookDeliveryProcessor(
  job: Job<WebhookDeliveryJobData>,
): Promise<{ status: number; durationMs: number }> {
  const { webhookId, tenantId, event, payload, deliveryId } = job.data;
  const attempt = job.attemptsMade + 1;
  const maxAttempts = job.opts.attempts ?? 1;
  const isLastAttempt = attempt >= maxAttempts;
  const log = logger.child({ queue: 'webhook-delivery', webhookId, tenantId, event, attempt });

  const webhook = await webhooksRepository.findByIdInTenant(webhookId, tenantId);
  if (!webhook) {
    log.warn('Webhook não encontrado no tenant — job ignorado (sem retry)');
    return { status: 0, durationMs: 0 };
  }

  // Garante um registro de delivery (pré-criado no teste, criado aqui no dispatch).
  let recordId = deliveryId ?? null;
  if (!recordId) {
    try {
      const created = await webhooksRepository.createDelivery({
        webhookId,
        event,
        payload: payload as Prisma.InputJsonValue,
        status: 'PENDING',
      });
      recordId = created.id;
    } catch (err) {
      log.warn({ err }, 'Falha ao criar registro de delivery (segue com o POST)');
    }
  }

  const body = { event, tenantId, timestamp: new Date().toISOString(), data: payload };
  const rawBody = JSON.stringify(body);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-WhatFlow-Event': event,
    ...((webhook.headers as Record<string, string>) ?? {}),
  };
  if (webhook.secret) headers['X-WhatFlow-Signature'] = signPayload(webhook.secret, rawBody);

  const startedAt = Date.now();
  let durationMs = 0;
  let httpStatus = 0;
  let responseBody = '';
  let failed = false;
  let failReason = '';

  try {
    const response: AxiosResponse = await axios.post(webhook.url, body, {
      headers,
      timeout: REQUEST_TIMEOUT_MS,
      // Não lançamos no axios: tratamos status >= 400 nós mesmos abaixo.
      validateStatus: () => true,
      transformRequest: [() => rawBody], // garante que o corpo assinado == corpo enviado
    });
    durationMs = Date.now() - startedAt;
    httpStatus = response.status;
    responseBody = truncate(response.data);
    failed = httpStatus >= 400;
    if (failed) failReason = `HTTP ${httpStatus}`;
  } catch (err) {
    durationMs = Date.now() - startedAt;
    const ax = err as AxiosError;
    httpStatus = ax.response?.status ?? 0;
    responseBody = truncate(ax.response?.data ?? ax.message);
    failed = true;
    failReason = ax.message || 'network error';
  }

  // Persistência do resultado (best-effort). durationMs vai dentro do payload
  // JSON do delivery (não há coluna dedicada no schema) + nos logs.
  if (recordId) {
    const status = failed ? (isLastAttempt ? 'FAILED' : 'RETRYING') : 'SUCCESS';
    const update: Prisma.WebhookDeliveryUpdateInput = {
      status,
      httpStatus: httpStatus || null,
      responseBody,
      attemptCount: attempt,
      payload: { ...body, durationMs } as Prisma.InputJsonValue,
      ...(failed ? {} : { deliveredAt: new Date() }),
    };
    await webhooksRepository
      .updateDelivery(recordId, update)
      .catch(err => log.warn({ err }, 'Falha ao gravar resultado do delivery (ignorado)'));
  }

  if (failed) {
    log.warn({ httpStatus, durationMs, failReason }, 'Entrega de webhook falhou (será re-tentada)');
    // Lança para o BullMQ aplicar o retry/backoff da fila.
    throw new Error(`Webhook delivery failed: ${failReason}`);
  }

  log.info({ httpStatus, durationMs }, 'Webhook entregue com sucesso');
  return { status: httpStatus, durationMs };
}
