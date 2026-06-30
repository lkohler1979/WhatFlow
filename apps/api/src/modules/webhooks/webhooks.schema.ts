import { z } from 'zod';

/**
 * Eventos de saída suportados. Espelham o enum `WebhookEvent` do Prisma
 * (apps/api/prisma/schema.prisma). Usamos os mesmos identificadores do banco
 * para gravar direto em `Webhook.events` / `WebhookDelivery.event` sem mapear.
 */
export const WEBHOOK_EVENTS = [
  'MESSAGE_RECEIVED',
  'MESSAGE_SENT',
  'FLOW_STARTED',
  'FLOW_COMPLETED',
  'FLOW_FAILED',
  'LEAD_CAPTURED',
  'AGENT_ASSIGNED',
  'CONVERSATION_RESOLVED',
  'CAMPAIGN_COMPLETED',
] as const;

export const WebhookEventSchema = z.enum(WEBHOOK_EVENTS);

const webhookBaseShape = z.object({
  name: z.string().min(2).max(100),
  url: z.string().url().max(500),
  /** Lista de eventos que disparam este webhook (ao menos um). */
  events: z.array(WebhookEventSchema).min(1).max(WEBHOOK_EVENTS.length),
  /**
   * Segredo HMAC-SHA256. Opcional na criação — se ausente, o service gera um
   * (32 bytes hex). Usado para assinar o header `X-WhatFlow-Signature`.
   */
  secret: z.string().min(8).max(200).optional(),
  /** Headers HTTP customizados enviados na entrega (ex.: Authorization). */
  headers: z.record(z.string()).default({}),
  isActive: z.boolean().default(true),
});

export const CreateWebhookSchema = webhookBaseShape;

/** Update parcial — todos os campos opcionais; events, se vier, ainda exige ≥1. */
export const UpdateWebhookSchema = webhookBaseShape.partial();

/** Filtro/paginação na listagem de entregas. */
export const ListDeliveriesQuerySchema = z.object({
  status: z.enum(['PENDING', 'SUCCESS', 'FAILED', 'RETRYING']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateWebhookDto = z.infer<typeof CreateWebhookSchema>;
export type UpdateWebhookDto = z.infer<typeof UpdateWebhookSchema>;
export type ListDeliveriesQuery = z.infer<typeof ListDeliveriesQuerySchema>;
export type WebhookEventName = z.infer<typeof WebhookEventSchema>;
