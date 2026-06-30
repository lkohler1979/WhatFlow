import { randomBytes } from 'node:crypto';
import { webhooksRepository } from './webhooks.repository.js';
import { NotFoundError } from '@core/errors.js';
import { logger } from '@core/logger.js';
import { addJob, webhookDeliveryQueue } from '@queues/index.js';
import type { WebhookDeliveryJobData } from '@queues/processors/webhook-delivery.processor.js';
import type { CreateWebhookDto, UpdateWebhookDto, ListDeliveriesQuery } from './webhooks.schema.js';
import type { Prisma, Webhook, WebhookDelivery, WebhookEvent } from '@prisma/client';

/** O secret nunca é devolvido em listagens; apenas indicamos se existe. */
interface WebhookView {
  id: string;
  name: string;
  url: string;
  events: WebhookEvent[];
  headers: Prisma.JsonValue;
  isActive: boolean;
  hasSecret: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function toView(w: Webhook): WebhookView {
  return {
    id: w.id,
    name: w.name,
    url: w.url,
    events: w.events,
    headers: w.headers,
    isActive: w.isActive,
    hasSecret: !!w.secret,
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
  };
}

function generateSecret(): string {
  return randomBytes(32).toString('hex');
}

export const webhooksService = {
  async list(
    tenantId: string,
    opts: { page: number; pageSize: number },
  ): Promise<{ data: WebhookView[]; total: number; page: number; pageSize: number }> {
    const { data, total } = await webhooksRepository.listByTenant(tenantId, opts);
    return { data: data.map(toView), total, page: opts.page, pageSize: opts.pageSize };
  },

  async get(tenantId: string, id: string): Promise<WebhookView> {
    const webhook = await webhooksRepository.findByIdInTenant(id, tenantId);
    if (!webhook) throw new NotFoundError('Webhook');
    return toView(webhook);
  },

  async create(tenantId: string, dto: CreateWebhookDto): Promise<WebhookView> {
    const webhook = await webhooksRepository.create({
      tenantId,
      name: dto.name,
      url: dto.url,
      events: dto.events as WebhookEvent[],
      secret: dto.secret ?? generateSecret(),
      headers: (dto.headers ?? {}) as Prisma.InputJsonValue,
      isActive: dto.isActive,
    });
    return toView(webhook);
  },

  async update(tenantId: string, id: string, dto: UpdateWebhookDto): Promise<WebhookView> {
    await this.get(tenantId, id); // 404 se não existir no tenant
    const data: Prisma.WebhookUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.url !== undefined) data.url = dto.url;
    if (dto.events !== undefined) data.events = dto.events as WebhookEvent[];
    if (dto.secret !== undefined) data.secret = dto.secret;
    if (dto.headers !== undefined) data.headers = dto.headers as Prisma.InputJsonValue;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    await webhooksRepository.update(id, tenantId, data);
    return this.get(tenantId, id);
  },

  async remove(tenantId: string, id: string): Promise<void> {
    await this.get(tenantId, id);
    await webhooksRepository.remove(id, tenantId);
  },

  /** Histórico de entregas de um webhook (paginado), com status/tempo/resposta. */
  async listDeliveries(
    tenantId: string,
    webhookId: string,
    query: ListDeliveriesQuery,
  ): Promise<{ data: WebhookDelivery[]; total: number; page: number; pageSize: number }> {
    await this.get(tenantId, webhookId); // garante posse pelo tenant
    const { data, total } = await webhooksRepository.listDeliveries(webhookId, query);
    return { data, total, page: query.page, pageSize: query.pageSize };
  },

  /**
   * Disparo de evento (T-047). Acha os webhooks ATIVOS do tenant inscritos no
   * evento e enfileira UM job de entrega por webhook na fila `webhook-delivery`.
   *
   * NÃO faz o POST inline — quem entrega (com HMAC, medição de tempo, retry) é o
   * worker. É best-effort por design: se nenhum webhook estiver inscrito, não faz
   * nada; falhas ao enfileirar são logadas e não propagadas (não devem quebrar o
   * fluxo de negócio que disparou o evento).
   *
   * @returns quantos jobs foram enfileirados.
   */
  async dispatchEvent(
    tenantId: string,
    event: WebhookEvent,
    payload: Record<string, unknown>,
  ): Promise<number> {
    let subscribers: Webhook[];
    try {
      subscribers = await webhooksRepository.findActiveSubscribers(tenantId, event);
    } catch (err) {
      logger.error({ tenantId, event, err }, 'Falha ao buscar webhooks inscritos no evento');
      return 0;
    }
    if (subscribers.length === 0) return 0;

    let enqueued = 0;
    for (const webhook of subscribers) {
      try {
        const job: WebhookDeliveryJobData = {
          webhookId: webhook.id,
          tenantId,
          event,
          payload,
        };
        await addJob(webhookDeliveryQueue, `webhook:${event}`, job);
        enqueued += 1;
      } catch (err) {
        logger.error(
          { tenantId, event, webhookId: webhook.id, err },
          'Falha ao enfileirar entrega de webhook',
        );
      }
    }
    logger.info(
      { tenantId, event, subscribers: subscribers.length, enqueued },
      'Evento despachado',
    );
    return enqueued;
  },

  /**
   * Teste manual (T-048): enfileira a entrega de um payload de exemplo para um
   * webhook específico. Cria o registro de delivery e devolve seu id para que a
   * tela possa acompanhar o resultado no histórico.
   */
  async testWebhook(
    tenantId: string,
    id: string,
  ): Promise<{ deliveryId: string; enqueued: boolean }> {
    const webhook = await webhooksRepository.findByIdInTenant(id, tenantId);
    if (!webhook) throw new NotFoundError('Webhook');

    // Usa o primeiro evento inscrito como rótulo do teste (ou MESSAGE_RECEIVED).
    const event: WebhookEvent = webhook.events[0] ?? 'MESSAGE_RECEIVED';
    const payload: Record<string, unknown> = {
      test: true,
      event,
      message: 'Disparo de teste do WhatFlow',
      timestamp: new Date().toISOString(),
    };

    // Pré-cria o registro de delivery para que a tela o veja imediatamente.
    const delivery = await webhooksRepository.createDelivery({
      webhookId: webhook.id,
      event,
      payload: payload as Prisma.InputJsonValue,
      status: 'PENDING',
    });

    const job: WebhookDeliveryJobData = {
      webhookId: webhook.id,
      tenantId,
      event,
      payload,
      deliveryId: delivery.id,
    };
    await addJob(webhookDeliveryQueue, `webhook:test:${event}`, job);
    return { deliveryId: delivery.id, enqueued: true };
  },
};
