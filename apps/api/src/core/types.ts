/** Resposta paginada padrão da API */
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    limit: number;
    cursor: string | null;
    hasMore: boolean;
  };
}

/** Roles do sistema */
export type UserRole = 'OWNER' | 'ADMIN' | 'AGENT' | 'VIEWER';

/** Status das instâncias */
export type InstanceStatus = 'PENDING' | 'QR_PENDING' | 'CONNECTED' | 'DISCONNECTED' | 'BANNED';

/** Status das conversas */
export type ConversationStatus = 'OPEN' | 'PENDING' | 'RESOLVED' | 'SPAM';

/** Status das mensagens */
export type MessageStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

/** Status das campanhas */
export type CampaignStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED';
