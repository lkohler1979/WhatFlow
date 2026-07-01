import { prisma } from '@core/prisma.js';
import type {
  Prisma,
  Webhook,
  WebhookDelivery,
  WebhookDeliveryStatus,
  WebhookEvent,
} from '@prisma/client';

/**
 * Acesso a dados de webhooks de saída — sempre escopado por tenant nas
 * operações de CRUD (Prisma bypassa RLS, então o tenant entra no `where`).
 * As operações chamadas pelo worker (delivery create/update) recebem ids já
 * resolvidos pelo dispatch e não precisam re-filtrar por tenant.
 */
export const webhooksRepository = {
  // ── CRUD de Webhook (tenant-scoped) ──

  async listByTenant(
    tenantId: string,
    opts: { page: number; pageSize: number },
  ): Promise<{ data: Webhook[]; total: number }> {
    const where: Prisma.WebhookWhereInput = { tenantId };
    const [data, total] = await Promise.all([
      prisma.webhook.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (opts.page - 1) * opts.pageSize,
        take: opts.pageSize,
      }),
      prisma.webhook.count({ where }),
    ]);
    return { data, total };
  },

  findByIdInTenant(id: string, tenantId: string): Promise<Webhook | null> {
    return prisma.webhook.findFirst({ where: { id, tenantId } });
  },

  create(data: Prisma.WebhookUncheckedCreateInput): Promise<Webhook> {
    return prisma.webhook.create({ data });
  },

  async update(id: string, tenantId: string, data: Prisma.WebhookUpdateInput): Promise<number> {
    const res = await prisma.webhook.updateMany({ where: { id, tenantId }, data });
    return res.count;
  },

  async remove(id: string, tenantId: string): Promise<number> {
    const res = await prisma.webhook.deleteMany({ where: { id, tenantId } });
    return res.count;
  },

  /**
   * Webhooks ATIVOS do tenant inscritos no evento. Usado por dispatchEvent
   * para decidir quais entregas enfileirar. `events` é um array do enum
   * `WebhookEvent`; o filtro `has` casa quando o evento está na lista.
   */
  findActiveSubscribers(tenantId: string, event: WebhookEvent): Promise<Webhook[]> {
    return prisma.webhook.findMany({
      where: { tenantId, isActive: true, events: { has: event } },
    });
  },

  // ── Entregas (WebhookDelivery) ──

  async listDeliveries(
    webhookId: string,
    opts: { status?: WebhookDeliveryStatus; page: number; pageSize: number },
  ): Promise<{ data: WebhookDelivery[]; total: number }> {
    const where: Prisma.WebhookDeliveryWhereInput = { webhookId };
    if (opts.status) where.status = opts.status;
    const [data, total] = await Promise.all([
      prisma.webhookDelivery.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (opts.page - 1) * opts.pageSize,
        take: opts.pageSize,
      }),
      prisma.webhookDelivery.count({ where }),
    ]);
    return { data, total };
  },

  /** Cria o registro de entrega (estado inicial PENDING). */
  createDelivery(data: Prisma.WebhookDeliveryUncheckedCreateInput): Promise<WebhookDelivery> {
    return prisma.webhookDelivery.create({ data });
  },

  /** Atualiza o resultado de uma tentativa de entrega (best-effort no worker). */
  async updateDelivery(id: string, data: Prisma.WebhookDeliveryUpdateInput): Promise<void> {
    await prisma.webhookDelivery.update({ where: { id }, data });
  },
};
