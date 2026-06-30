import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services/api.service';

export type CampaignStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED';

export type CampaignMessageType = 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT';

export interface Campaign {
  id: string;
  name: string;
  description?: string | null;
  status: CampaignStatus;
  instanceId: string;
  messageType: CampaignMessageType;
  messageContent?: string | null;
  mediaUrl?: string | null;
  mediaCaption?: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  delayMinMs?: number;
  delayMaxMs?: number;
  totalContacts: number;
  sentCount: number;
  deliveredCount: number;
  readCount?: number;
  failedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignListResponse {
  data: Campaign[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CampaignPayload {
  name: string;
  description?: string | null;
  instanceId: string;
  messageType: CampaignMessageType;
  messageContent?: string | null;
  mediaUrl?: string | null;
  mediaCaption?: string | null;
  scheduledAt?: string | null;
  delayMinMs: number;
  delayMaxMs: number;
  /** Contatos já cadastrados selecionados. */
  contactIds?: string[];
  /** Telefones brutos (ex.: vindos de CSV) — resolvidos no backend. */
  phones?: string[];
}

@Injectable({ providedIn: 'root' })
export class CampaignsService {
  private api = inject(ApiService);

  list(
    params: { status?: CampaignStatus; page?: number; pageSize?: number } = {},
  ): Observable<CampaignListResponse> {
    return this.api.get<CampaignListResponse>('/campaigns', {
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 20,
      ...(params.status ? { status: params.status } : {}),
    });
  }

  create(payload: CampaignPayload): Observable<Campaign> {
    return this.api.post<Campaign>('/campaigns', payload);
  }

  start(id: string): Observable<Campaign> {
    return this.api.post<Campaign>(`/campaigns/${id}/start`, {});
  }

  pause(id: string): Observable<Campaign> {
    return this.api.post<Campaign>(`/campaigns/${id}/pause`, {});
  }

  cancel(id: string): Observable<Campaign> {
    return this.api.post<Campaign>(`/campaigns/${id}/cancel`, {});
  }

  remove(id: string): Observable<void> {
    return this.api.delete<void>(`/campaigns/${id}`);
  }
}
