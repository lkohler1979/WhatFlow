import {
  CreateWebhookSchema,
  UpdateWebhookSchema,
  ListDeliveriesQuerySchema,
} from '@modules/webhooks/webhooks.schema.js';

describe('webhooks.schema', () => {
  describe('CreateWebhookSchema', () => {
    it('aceita webhook mínimo e aplica defaults (headers/isActive)', () => {
      const r = CreateWebhookSchema.safeParse({
        name: 'CRM',
        url: 'https://example.com/hook',
        events: ['MESSAGE_RECEIVED'],
      });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.headers).toEqual({});
        expect(r.data.isActive).toBe(true);
        expect(r.data.secret).toBeUndefined();
      }
    });

    it('rejeita url inválida', () => {
      const r = CreateWebhookSchema.safeParse({
        name: 'CRM',
        url: 'not-a-url',
        events: ['MESSAGE_RECEIVED'],
      });
      expect(r.success).toBe(false);
    });

    it('exige ao menos um evento', () => {
      const r = CreateWebhookSchema.safeParse({
        name: 'CRM',
        url: 'https://example.com/hook',
        events: [],
      });
      expect(r.success).toBe(false);
    });

    it('rejeita evento desconhecido', () => {
      const r = CreateWebhookSchema.safeParse({
        name: 'CRM',
        url: 'https://example.com/hook',
        events: ['WAT_EVENT'],
      });
      expect(r.success).toBe(false);
    });

    it('rejeita secret curto demais', () => {
      const r = CreateWebhookSchema.safeParse({
        name: 'CRM',
        url: 'https://example.com/hook',
        events: ['MESSAGE_RECEIVED'],
        secret: 'short',
      });
      expect(r.success).toBe(false);
    });
  });

  describe('UpdateWebhookSchema', () => {
    it('permite parcial vazio', () => {
      expect(UpdateWebhookSchema.safeParse({}).success).toBe(true);
    });
    it('se events vier, ainda exige ≥1', () => {
      expect(UpdateWebhookSchema.safeParse({ events: [] }).success).toBe(false);
    });
  });

  describe('ListDeliveriesQuerySchema', () => {
    it('aplica defaults de paginação', () => {
      const r = ListDeliveriesQuerySchema.safeParse({});
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.page).toBe(1);
        expect(r.data.pageSize).toBe(20);
      }
    });
    it('rejeita status inválido', () => {
      expect(ListDeliveriesQuerySchema.safeParse({ status: 'NOPE' }).success).toBe(false);
    });
  });
});
