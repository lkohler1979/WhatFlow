import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services/api.service';

/** Eventos de saída suportados (espelha o enum WebhookEvent do backend). */
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

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/** Rótulos amigáveis para os eventos. */
export const WEBHOOK_EVENT_LABELS: Record<WebhookEvent, string> = {
  MESSAGE_RECEIVED: 'Mensagem recebida',
  MESSAGE_SENT: 'Mensagem enviada',
  FLOW_STARTED: 'Fluxo iniciado',
  FLOW_COMPLETED: 'Fluxo concluído',
  FLOW_FAILED: 'Fluxo falhou',
  LEAD_CAPTURED: 'Lead capturado',
  AGENT_ASSIGNED: 'Agente atribuído',
  CONVERSATION_RESOLVED: 'Conversa resolvida',
  CAMPAIGN_COMPLETED: 'Campanha concluída',
};

/** Webhook como devolvido pela API. O secret NUNCA vem — só hasSecret. */
export interface WebhookView {
  id: string;
  name: string;
  url: string;
  events: WebhookEvent[];
  isActive: boolean;
  hasSecret: boolean;
  headers?: Record<string, string> | null;
  createdAt: string;
  updatedAt: string;
}

/** Payload de criação. secret opcional (gerado se omitido). */
export interface CreateWebhookPayload {
  name: string;
  url: string;
  events: WebhookEvent[];
  isActive?: boolean;
  secret?: string;
}

/** Update parcial. */
export type UpdateWebhookPayload = Partial<CreateWebhookPayload>;

export type WebhookDeliveryStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'RETRYING';

/** Entrega de webhook (histórico). durationMs vive dentro de payload. */
export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: WebhookEvent;
  status: WebhookDeliveryStatus;
  httpStatus: number | null;
  responseBody: string | null;
  attemptCount: number;
  deliveredAt: string | null;
  createdAt: string;
  payload: { durationMs?: number; [key: string]: unknown } | null;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TestResult {
  deliveryId: string;
  enqueued: boolean;
}

@Injectable({ providedIn: 'root' })
export class WebhooksService {
  private api = inject(ApiService);

  list(page = 1, pageSize = 50): Observable<Paginated<WebhookView>> {
    return this.api.get<Paginated<WebhookView>>('/webhooks', { page, pageSize });
  }

  get(id: string): Observable<WebhookView> {
    return this.api.get<WebhookView>(`/webhooks/${id}`);
  }

  create(payload: CreateWebhookPayload): Observable<WebhookView> {
    return this.api.post<WebhookView>('/webhooks', payload);
  }

  update(id: string, payload: UpdateWebhookPayload): Observable<WebhookView> {
    return this.api.patch<WebhookView>(`/webhooks/${id}`, payload);
  }

  remove(id: string): Observable<void> {
    return this.api.delete<void>(`/webhooks/${id}`);
  }

  test(id: string): Observable<TestResult> {
    return this.api.post<TestResult>(`/webhooks/${id}/test`, {});
  }

  deliveries(id: string, page = 1, pageSize = 10): Observable<Paginated<WebhookDelivery>> {
    return this.api.get<Paginated<WebhookDelivery>>(`/webhooks/${id}/deliveries`, {
      page,
      pageSize,
    });
  }
}
