import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services/api.service';

export type ConversationStatus = 'OPEN' | 'PENDING' | 'RESOLVED' | 'SPAM';
export type MessageDirection = 'INBOUND' | 'OUTBOUND';

export interface ConversationContact {
  id: string;
  name: string | null;
  phone: string;
  avatarUrl: string | null;
}

export interface Conversation {
  id: string;
  contact: ConversationContact;
  status: ConversationStatus;
  botActive: boolean;
  unreadCount: number;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  instanceId: string;
  assignedToUserId?: string | null;
}

export interface Message {
  id: string;
  direction: MessageDirection;
  content: string;
  type: string;
  status: string;
  timestamp: string;
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ConversationFilters {
  status?: ConversationStatus | '';
  search?: string;
  page?: number;
  pageSize?: number;
}

@Injectable({ providedIn: 'root' })
export class InboxService {
  private api = inject(ApiService);

  listConversations(filters: ConversationFilters): Observable<Paginated<Conversation>> {
    const params: Record<string, string | number | boolean> = {
      page: filters.page ?? 1,
      pageSize: filters.pageSize ?? 20,
    };
    if (filters.status) params['status'] = filters.status;
    if (filters.search) params['search'] = filters.search;
    return this.api.get<Paginated<Conversation>>('/conversations', params);
  }

  getConversation(id: string): Observable<Conversation> {
    return this.api.get<Conversation>(`/conversations/${id}`);
  }

  listMessages(
    id: string,
    cursor?: string | null,
    limit = 30,
  ): Observable<{ data: Message[]; nextCursor: string | null }> {
    const params: Record<string, string | number | boolean> = { limit };
    if (cursor) params['cursor'] = cursor;
    return this.api.get<{ data: Message[]; nextCursor: string | null }>(
      `/conversations/${id}/messages`,
      params,
    );
  }

  sendMessage(id: string, text: string): Observable<Message> {
    return this.api.post<Message>(`/conversations/${id}/messages`, { text });
  }

  markRead(id: string): Observable<void> {
    return this.api.post<void>(`/conversations/${id}/read`, {});
  }

  /** Liga/desliga o bot da conversa (transferência bot↔humano). */
  setBotActive(id: string, botActive: boolean): Observable<Conversation> {
    return this.api.patch<Conversation>(`/conversations/${id}`, { botActive });
  }

  /** Atualiza o status da conversa (ex.: resolver). */
  setStatus(id: string, status: ConversationStatus): Observable<Conversation> {
    return this.api.patch<Conversation>(`/conversations/${id}`, { status });
  }
}
