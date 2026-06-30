import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services/api.service';

export type Granularity = 'day' | 'week';

export type ConversationStatus = 'OPEN' | 'PENDING' | 'RESOLVED' | 'SPAM';
export type InstanceStatus = 'PENDING' | 'QR_PENDING' | 'CONNECTED' | 'DISCONNECTED' | 'BANNED';
export type CampaignStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED';

export interface AnalyticsPeriod {
  from: string;
  to: string;
}

export interface CampaignsSummary {
  total: number;
  byStatus: Record<CampaignStatus, number>;
  sent: number;
  delivered: number;
  failed: number;
}

export interface Overview {
  period: AnalyticsPeriod;
  conversations: { total: number; byStatus: Record<ConversationStatus, number> };
  messages: { total: number; inbound: number; outbound: number };
  contacts: { total: number };
  instances: { byStatus: Record<InstanceStatus, number> };
  campaigns: CampaignsSummary;
}

export interface MessageSeriesPoint {
  bucket: string;
  inbound: number;
  outbound: number;
}

export interface MessagesSeries {
  period: AnalyticsPeriod;
  granularity: Granularity;
  series: MessageSeriesPoint[];
}

export interface CampaignsReport {
  period: AnalyticsPeriod;
  campaigns: CampaignsSummary;
}

/** Filtro de período usado por todos os endpoints de analytics. */
export interface PeriodQuery {
  from?: string;
  to?: string;
  granularity?: Granularity;
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private api = inject(ApiService);

  private toParams(q?: PeriodQuery): Record<string, string> {
    const params: Record<string, string> = {};
    if (q?.from) params['from'] = q.from;
    if (q?.to) params['to'] = q.to;
    if (q?.granularity) params['granularity'] = q.granularity;
    return params;
  }

  overview(q?: PeriodQuery): Observable<Overview> {
    return this.api.get<Overview>('/analytics/overview', this.toParams(q));
  }

  messages(q?: PeriodQuery): Observable<MessagesSeries> {
    return this.api.get<MessagesSeries>('/analytics/messages', this.toParams(q));
  }

  campaigns(q?: PeriodQuery): Observable<CampaignsReport> {
    return this.api.get<CampaignsReport>('/analytics/campaigns', this.toParams(q));
  }
}
