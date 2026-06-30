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

export interface ConversationTag {
  id: string;
  name: string;
  color: string;
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
  /** Tags da conversa (T-040). */
  tags?: ConversationTag[];
}

export interface Message {
  id: string;
  direction: MessageDirection;
  content: string;
  type: string;
  status: string;
  timestamp: string;
  /** Nota interna (T-040): true = não foi enviada ao WhatsApp. */
  isInternal?: boolean;
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
  /** Filtra conversas que possuem a tag (T-040). */
  tagId?: string | null;
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
    if (filters.tagId) params['tagId'] = filters.tagId;
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

  /**
   * Adiciona uma NOTA INTERNA à conversa (T-040). Não é enviada ao WhatsApp;
   * volta como Message com `isInternal: true`.
   */
  addNote(id: string, text: string): Observable<Message> {
    return this.api.post<Message>(`/conversations/${id}/notes`, { text });
  }

  /** Anexa uma tag à conversa (T-040). */
  attachTag(id: string, tagId: string): Observable<void> {
    return this.api.post<void>(`/conversations/${id}/tags`, { tagId });
  }

  /** Remove uma tag da conversa (T-040). */
  detachTag(id: string, tagId: string): Observable<void> {
    return this.api.delete<void>(`/conversations/${id}/tags/${tagId}`);
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
