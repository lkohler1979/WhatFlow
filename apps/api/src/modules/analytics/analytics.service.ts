import { analyticsRepository } from './analytics.repository.js';
import type { MessageSeriesPoint } from './analytics.repository.js';
import type { AnalyticsPeriod } from './analytics.schema.js';
import type { ConversationStatus, InstanceStatus, CampaignStatus } from '@prisma/client';

interface PeriodDto {
  from: string;
  to: string;
}

export interface OverviewDto {
  period: PeriodDto;
  conversations: { total: number; byStatus: Record<ConversationStatus, number> };
  messages: { total: number; inbound: number; outbound: number };
  contacts: { total: number };
  instances: { byStatus: Record<InstanceStatus, number> };
  campaigns: CampaignsSummaryDto['campaigns'];
}

export interface MessagesSeriesDto {
  period: PeriodDto;
  granularity: 'day' | 'week';
  series: { bucket: string; inbound: number; outbound: number }[];
}

export interface CampaignsSummaryDto {
  period: PeriodDto;
  campaigns: {
    total: number;
    byStatus: Record<CampaignStatus, number>;
    sent: number;
    delivered: number;
    failed: number;
  };
}

function periodDto(p: AnalyticsPeriod): PeriodDto {
  return { from: p.from.toISOString(), to: p.to.toISOString() };
}

export const analyticsService = {
  /** KPIs consolidados — consumido pelo dashboard (T-045). */
  async overview(tenantId: string, p: AnalyticsPeriod): Promise<OverviewDto> {
    const [conversations, messages, contactsTotal, instancesByStatus, campaigns] =
      await Promise.all([
        analyticsRepository.conversationCounts(tenantId, p),
        analyticsRepository.messageTotals(tenantId, p),
        analyticsRepository.contactsTotal(tenantId),
        analyticsRepository.instancesByStatus(tenantId),
        analyticsRepository.campaignCounts(tenantId, p),
      ]);

    return {
      period: periodDto(p),
      conversations: { total: conversations.total, byStatus: conversations.byStatus },
      messages,
      contacts: { total: contactsTotal },
      instances: { byStatus: instancesByStatus },
      campaigns,
    };
  },

  /** Série temporal de mensagens (gráfico do dashboard — T-045). */
  async messagesSeries(tenantId: string, p: AnalyticsPeriod): Promise<MessagesSeriesDto> {
    const rows = await analyticsRepository.messageSeriesRaw(tenantId, p);

    // Reduz as linhas (bucket, direção) em pontos com inbound/outbound juntos.
    const byBucket = new Map<string, MessageSeriesPoint>();
    for (const r of rows) {
      const key = r.bucket.toISOString();
      const point = byBucket.get(key) ?? { bucket: r.bucket, inbound: 0, outbound: 0 };
      const count = Number(r.count);
      if (r.direction === 'INBOUND') point.inbound += count;
      else if (r.direction === 'OUTBOUND') point.outbound += count;
      byBucket.set(key, point);
    }

    const series = [...byBucket.values()]
      .sort((a, b) => a.bucket.getTime() - b.bucket.getTime())
      .map(pt => ({
        bucket: pt.bucket.toISOString(),
        inbound: pt.inbound,
        outbound: pt.outbound,
      }));

    return { period: periodDto(p), granularity: p.granularity, series };
  },

  /** Resumo de campanhas (contagem por status + somatórios de envio). */
  async campaignsSummary(tenantId: string, p: AnalyticsPeriod): Promise<CampaignsSummaryDto> {
    const campaigns = await analyticsRepository.campaignCounts(tenantId, p);
    return { period: periodDto(p), campaigns };
  },
};
