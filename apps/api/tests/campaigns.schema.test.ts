import {
  CreateCampaignSchema,
  UpdateCampaignSchema,
  ListCampaignsQuerySchema,
} from '@modules/campaigns/campaigns.schema.js';

const uuid = '11111111-1111-1111-1111-111111111111';

describe('campaigns.schema', () => {
  describe('CreateCampaignSchema', () => {
    it('aceita campanha de texto mínima e aplica defaults de delay', () => {
      const r = CreateCampaignSchema.safeParse({
        name: 'Promo',
        instanceId: uuid,
        messageType: 'TEXT',
        messageContent: 'Olá!',
        contactIds: [uuid],
      });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.delayMinMs).toBe(3000);
        expect(r.data.delayMaxMs).toBe(8000);
      }
    });

    it('exige messageContent para TEXT', () => {
      const r = CreateCampaignSchema.safeParse({
        name: 'Promo',
        instanceId: uuid,
        messageType: 'TEXT',
        contactIds: [uuid],
      });
      expect(r.success).toBe(false);
    });

    it('exige mediaUrl para mídia', () => {
      const r = CreateCampaignSchema.safeParse({
        name: 'Promo',
        instanceId: uuid,
        messageType: 'IMAGE',
        contactIds: [uuid],
      });
      expect(r.success).toBe(false);
    });

    it('exige ao menos um contato', () => {
      const r = CreateCampaignSchema.safeParse({
        name: 'Promo',
        instanceId: uuid,
        messageType: 'TEXT',
        messageContent: 'oi',
        contactIds: [],
      });
      expect(r.success).toBe(false);
    });

    it('rejeita delayMin > delayMax', () => {
      const r = CreateCampaignSchema.safeParse({
        name: 'Promo',
        instanceId: uuid,
        messageType: 'TEXT',
        messageContent: 'oi',
        contactIds: [uuid],
        delayMinMs: 9000,
        delayMaxMs: 5000,
      });
      expect(r.success).toBe(false);
    });

    it('rejeita name muito curto', () => {
      const r = CreateCampaignSchema.safeParse({
        name: 'A',
        instanceId: uuid,
        messageType: 'TEXT',
        messageContent: 'oi',
        contactIds: [uuid],
      });
      expect(r.success).toBe(false);
    });
  });

  describe('UpdateCampaignSchema', () => {
    it('permite parcial vazio', () => {
      expect(UpdateCampaignSchema.safeParse({}).success).toBe(true);
    });
    it('valida delays quando ambos presentes', () => {
      expect(UpdateCampaignSchema.safeParse({ delayMinMs: 5000, delayMaxMs: 1000 }).success).toBe(
        false,
      );
    });
  });

  describe('ListCampaignsQuerySchema', () => {
    it('aplica defaults de paginação', () => {
      const r = ListCampaignsQuerySchema.safeParse({});
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.page).toBe(1);
        expect(r.data.pageSize).toBe(20);
      }
    });
    it('rejeita status inválido', () => {
      expect(ListCampaignsQuerySchema.safeParse({ status: 'WAT' }).success).toBe(false);
    });
  });
});
