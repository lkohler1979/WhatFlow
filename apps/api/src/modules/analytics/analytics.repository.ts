import { prisma } from '@core/prisma.js';
import { Prisma } from '@prisma/client';
import type {
  ConversationStatus,
  InstanceStatus,
  CampaignStatus,
  MessageDirection,
} from '@prisma/client';
import type { AnalyticsPeriod } from './analytics.schema.js';

/** Contagem de um enum específico (status) → total. */
export type EnumCount<T extends string> = Record<T, number>;

export interface ConversationCounts {
  total: number;
  byStatus: EnumCount<ConversationStatus>;
}

export interface MessageTotals {
  total: number;
  inbound: number;
  outbound: number;
}

export interface CampaignCounts {
  total: number;
  byStatus: EnumCount<CampaignStatus>;
  sent: number;
  delivered: number;
  failed: number;
}

/** Um ponto da série temporal de mensagens. `bucket` é o início do período (UTC). */
export interface MessageSeriesPoint {
  bucket: Date;
  inbound: number;
  outbound: number;
}

/** Linha crua devolvida pelo `$queryRaw` da série temporal. */
interface SeriesRow {
  bucket: Date;
  direction: MessageDirection;
  count: bigint;
}

/**
 * Acesso a dados de analytics — SEMPRE escopado por tenant. Como o Prisma
 * bypassa o RLS, todo filtro carrega `tenantId` explicitamente.
 *
 * Estratégia de performance:
 * - KPIs usam `count` / `groupBy` / `aggregate` (índices em tenantId, status,
 *   timestamp/createdAt) — sem N+1, uma agregação por métrica.
 * - A série temporal usa `$queryRaw` com `date_trunc` (Postgres), totalmente
 *   parametrizado (tenantId + range), filtrando por `conversation_id IN (...do tenant)`
 *   via JOIN — a tabela messages não tem tenantId direto.
 */
export const analyticsRepository = {
  // ── Conversas ────────────────────────────────────────────────────────────
  async conversationCounts(tenantId: string, p: AnalyticsPeriod): Promise<ConversationCounts> {
    const where: Prisma.ConversationWhereInput = {
      tenantId,
      createdAt: { gte: p.from, lte: p.to },
    };
    const [total, grouped] = await Promise.all([
      prisma.conversation.count({ where }),
      prisma.conversation.groupBy({ by: ['status'], where, _count: { _all: true } }),
    ]);
    const byStatus = emptyEnumCount<ConversationStatus>(['OPEN', 'PENDING', 'RESOLVED', 'SPAM']);
    for (const g of grouped) byStatus[g.status] = g._count._all;
    return { total, byStatus };
  },

  // ── Mensagens (totais INBOUND vs OUTBOUND no período) ──────────────────────
  async messageTotals(tenantId: string, p: AnalyticsPeriod): Promise<MessageTotals> {
    const baseWhere: Prisma.MessageWhereInput = {
      conversation: { tenantId },
      timestamp: { gte: p.from, lte: p.to },
    };
    const grouped = await prisma.message.groupBy({
      by: ['direction'],
      where: baseWhere,
      _count: { _all: true },
    });
    let inbound = 0;
    let outbound = 0;
    for (const g of grouped) {
      if (g.direction === 'INBOUND') inbound = g._count._all;
      else if (g.direction === 'OUTBOUND') outbound = g._count._all;
    }
    return { total: inbound + outbound, inbound, outbound };
  },

  // ── Contatos (total acumulado no tenant) ──────────────────────────────────
  contactsTotal(tenantId: string): Promise<number> {
    return prisma.contact.count({ where: { tenantId } });
  },

  // ── Instâncias por status ──────────────────────────────────────────────────
  async instancesByStatus(tenantId: string): Promise<EnumCount<InstanceStatus>> {
    const grouped = await prisma.instance.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { _all: true },
    });
    const byStatus = emptyEnumCount<InstanceStatus>([
      'PENDING',
      'QR_PENDING',
      'CONNECTED',
      'DISCONNECTED',
      'BANNED',
    ]);
    for (const g of grouped) byStatus[g.status] = g._count._all;
    return byStatus;
  },

  // ── Campanhas (contagem por status + somatório de envios) ──────────────────
  async campaignCounts(tenantId: string, p: AnalyticsPeriod): Promise<CampaignCounts> {
    const where: Prisma.CampaignWhereInput = {
      tenantId,
      createdAt: { gte: p.from, lte: p.to },
    };
    const [total, grouped, sums] = await Promise.all([
      prisma.campaign.count({ where }),
      prisma.campaign.groupBy({ by: ['status'], where, _count: { _all: true } }),
      prisma.campaign.aggregate({
        where,
        _sum: { sentCount: true, deliveredCount: true, failedCount: true },
      }),
    ]);
    const byStatus = emptyEnumCount<CampaignStatus>([
      'DRAFT',
      'SCHEDULED',
      'RUNNING',
      'PAUSED',
      'COMPLETED',
      'CANCELLED',
      'FAILED',
    ]);
    for (const g of grouped) byStatus[g.status] = g._count._all;
    return {
      total,
      byStatus,
      sent: sums._sum.sentCount ?? 0,
      delivered: sums._sum.deliveredCount ?? 0,
      failed: sums._sum.failedCount ?? 0,
    };
  },

  /**
   * Série temporal de mensagens agrupada por dia/semana, separando direção.
   * `$queryRaw` (parametrizado, tenant-scoped via JOIN em conversations) usa
   * `date_trunc` para o bucketing em UTC — eficiente com o índice em
   * `messages.timestamp`. Devolve uma linha por (bucket, direção).
   */
  async messageSeriesRaw(tenantId: string, p: AnalyticsPeriod): Promise<SeriesRow[]> {
    // `granularity` é validado pelo Zod (enum 'day'|'week'); seguro interpolar
    // como literal SQL via Prisma.raw — não vem de input livre.
    const unit = Prisma.raw(`'${p.granularity}'`);
    return prisma.$queryRaw<SeriesRow[]>`
      SELECT
        date_trunc(${unit}, m."timestamp") AS bucket,
        m."direction" AS direction,
        COUNT(*)::bigint AS count
      FROM "messages" m
      INNER JOIN "conversations" c ON c."id" = m."conversation_id"
      WHERE c."tenant_id" = ${tenantId}::uuid
        AND m."timestamp" >= ${p.from}
        AND m."timestamp" <= ${p.to}
      GROUP BY bucket, m."direction"
      ORDER BY bucket ASC
    `;
  },
};

/** Cria um mapa de enum→0 para todos os valores possíveis (sem buracos no DTO). */
function emptyEnumCount<T extends string>(values: readonly T[]): EnumCount<T> {
  const out = {} as EnumCount<T>;
  for (const v of values) out[v] = 0;
  return out;
}
