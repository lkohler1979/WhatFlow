import { Injectable, NgZone, inject, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '@env/environment';
import { AuthService } from './auth.service';

export interface InstanceStatusEvent {
  id: string;
  status: 'PENDING' | 'QR_PENDING' | 'CONNECTED' | 'DISCONNECTED' | 'BANNED';
  qrCode?: string | null;
}

export interface InboxMessagePayload {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  content: string;
  type: string;
  status: string;
  timestamp: string;
}

/**
 * `message:new` chega em duas formas: do envio do agente (`messages.service`,
 * com `message` completa) e do recebimento via webhook (`webhook-receiver`,
 * só `contactId`+`preview`). Por isso ambos os campos são opcionais.
 */
export interface MessageEvent {
  conversationId: string;
  contactId?: string;
  preview?: string;
  message?: InboxMessagePayload;
}

export interface ConversationUpdatedEvent {
  id: string;
  status?: string;
  botActive?: boolean;
  unreadCount?: number;
  lastMessagePreview?: string | null;
  lastMessageAt?: string | null;
}

export interface ConversationReadEvent {
  id: string;
  unreadCount: number;
}

export interface CampaignProgressEvent {
  campaignId: string;
  sent: number;
  failed: number;
  total: number;
  status: 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
}

@Injectable({ providedIn: 'root' })
export class SocketService {
  private auth = inject(AuthService);
  private zone = inject(NgZone);
  private socket: Socket | null = null;

  /** Último evento de status de instância recebido (realtime). */
  readonly instanceStatus = signal<InstanceStatusEvent | null>(null);
  /** Última mensagem recebida (realtime). */
  readonly lastMessage = signal<MessageEvent | null>(null);
  /** Último progresso de campanha recebido (realtime). */
  readonly campaignProgress = signal<CampaignProgressEvent | null>(null);
  /** Última conversa atualizada (status/atribuição/preview). */
  readonly conversationUpdated = signal<ConversationUpdatedEvent | null>(null);
  /** Última conversa marcada como lida. */
  readonly conversationRead = signal<ConversationReadEvent | null>(null);
  readonly connected = signal(false);

  /** Conecta ao Socket.io e entra na sala do tenant. Idempotente. */
  connect(): void {
    if (this.socket) return;
    // O Socket.io fica na raiz do servidor (sem o /v1)
    const base = environment.apiUrl.replace(/\/v1\/?$/, '');
    const socket = io(base, { transports: ['websocket', 'polling'] });
    this.socket = socket;

    // Os callbacks do socket.io rodam fora da zona do Angular; envolvemos em
    // zone.run para que as atualizações de signal disparem o change detection.
    socket.on('connect', () =>
      this.zone.run(() => {
        this.connected.set(true);
        const tenantId = this.auth.user()?.tenantId;
        if (tenantId) socket.emit('join:tenant', tenantId);
      }),
    );
    socket.on('disconnect', () => this.zone.run(() => this.connected.set(false)));
    socket.on('instance:status', (p: InstanceStatusEvent) =>
      this.zone.run(() => this.instanceStatus.set(p)),
    );
    socket.on('message:new', (p: MessageEvent) => this.zone.run(() => this.lastMessage.set(p)));
    socket.on('campaign:progress', (p: CampaignProgressEvent) =>
      this.zone.run(() => this.campaignProgress.set(p)),
    );
    socket.on('conversation:updated', (p: ConversationUpdatedEvent) =>
      this.zone.run(() => this.conversationUpdated.set(p)),
    );
    socket.on('conversation:read', (p: ConversationReadEvent) =>
      this.zone.run(() => this.conversationRead.set(p)),
    );
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.connected.set(false);
  }
}
