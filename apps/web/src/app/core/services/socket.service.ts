import { Injectable, inject, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '@env/environment';
import { AuthService } from './auth.service';

export interface InstanceStatusEvent {
  id: string;
  status: 'PENDING' | 'QR_PENDING' | 'CONNECTED' | 'DISCONNECTED' | 'BANNED';
  qrCode?: string | null;
}

export interface MessageEvent {
  conversationId: string;
  contactId: string;
  preview: string;
}

@Injectable({ providedIn: 'root' })
export class SocketService {
  private auth = inject(AuthService);
  private socket: Socket | null = null;

  /** Último evento de status de instância recebido (realtime). */
  readonly instanceStatus = signal<InstanceStatusEvent | null>(null);
  /** Última mensagem recebida (realtime). */
  readonly lastMessage = signal<MessageEvent | null>(null);
  readonly connected = signal(false);

  /** Conecta ao Socket.io e entra na sala do tenant. Idempotente. */
  connect(): void {
    if (this.socket) return;
    // O Socket.io fica na raiz do servidor (sem o /v1)
    const base = environment.apiUrl.replace(/\/v1\/?$/, '');
    const socket = io(base, { transports: ['websocket', 'polling'] });
    this.socket = socket;

    socket.on('connect', () => {
      this.connected.set(true);
      const tenantId = this.auth.user()?.tenantId;
      if (tenantId) socket.emit('join:tenant', tenantId);
    });
    socket.on('disconnect', () => this.connected.set(false));
    socket.on('instance:status', (p: InstanceStatusEvent) => this.instanceStatus.set(p));
    socket.on('message:new', (p: MessageEvent) => this.lastMessage.set(p));
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.connected.set(false);
  }
}
