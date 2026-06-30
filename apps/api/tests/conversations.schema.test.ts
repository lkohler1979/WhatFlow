import {
  ListConversationsQuerySchema,
  UpdateConversationSchema,
} from '@modules/conversations/conversations.schema.js';
import { ListMessagesQuerySchema, SendMessageSchema } from '@modules/messages/messages.schema.js';

const uuid = '11111111-1111-1111-1111-111111111111';

describe('conversations.schema', () => {
  describe('ListConversationsQuerySchema', () => {
    it('aplica defaults de paginação', () => {
      const r = ListConversationsQuerySchema.safeParse({});
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.page).toBe(1);
        expect(r.data.pageSize).toBe(20);
      }
    });

    it('coage botActive "true"/"false" → boolean', () => {
      const t = ListConversationsQuerySchema.safeParse({ botActive: 'true' });
      const f = ListConversationsQuerySchema.safeParse({ botActive: 'false' });
      expect(t.success && t.data.botActive).toBe(true);
      expect(f.success && f.data.botActive).toBe(false);
    });

    it('aceita filtros (status, instanceId, assignedToUserId, search)', () => {
      const r = ListConversationsQuerySchema.safeParse({
        status: 'OPEN',
        instanceId: uuid,
        assignedToUserId: uuid,
        search: 'joão',
      });
      expect(r.success).toBe(true);
    });

    it('rejeita status inválido', () => {
      expect(ListConversationsQuerySchema.safeParse({ status: 'CLOSED' }).success).toBe(false);
    });

    it('aceita contactId (uuid) para histórico do contato', () => {
      const r = ListConversationsQuerySchema.safeParse({ contactId: uuid });
      expect(r.success && r.data.contactId).toBe(uuid);
    });

    it('rejeita contactId não-uuid', () => {
      expect(ListConversationsQuerySchema.safeParse({ contactId: 'abc' }).success).toBe(false);
    });
  });

  describe('UpdateConversationSchema', () => {
    it('aceita desatribuir com assignedToUserId null', () => {
      const r = UpdateConversationSchema.safeParse({ assignedToUserId: null });
      expect(r.success).toBe(true);
    });

    it('aceita atualizar status e bot', () => {
      const r = UpdateConversationSchema.safeParse({ status: 'RESOLVED', botActive: false });
      expect(r.success).toBe(true);
    });

    it('rejeita corpo vazio (nada para atualizar)', () => {
      expect(UpdateConversationSchema.safeParse({}).success).toBe(false);
    });
  });
});

describe('messages.schema', () => {
  it('ListMessagesQuerySchema aplica limit default 30', () => {
    const r = ListMessagesQuerySchema.safeParse({});
    expect(r.success && r.data.limit).toBe(30);
  });

  it('ListMessagesQuerySchema aceita cursor uuid', () => {
    const r = ListMessagesQuerySchema.safeParse({ cursor: uuid, limit: '10' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.limit).toBe(10);
  });

  it('SendMessageSchema exige texto não vazio', () => {
    expect(SendMessageSchema.safeParse({ text: '' }).success).toBe(false);
    expect(SendMessageSchema.safeParse({ text: 'oi' }).success).toBe(true);
  });
});
