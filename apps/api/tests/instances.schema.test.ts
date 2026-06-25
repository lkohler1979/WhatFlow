import {
  CreateInstanceSchema,
  UpdateInstanceSchema,
  SendMessageSchema,
} from '@modules/instances/instances.schema.js';

describe('instances.schema', () => {
  it('aceita criação mínima (só name) e aplica defaults de settings', () => {
    const r = CreateInstanceSchema.safeParse({ name: 'Atendimento' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.settings.sendDelayMinMs).toBe(3000);
      expect(r.data.settings.sendDelayMaxMs).toBe(8000);
      expect(r.data.settings.autoRead).toBe(false);
    }
  });

  it('rejeita name muito curto', () => {
    expect(CreateInstanceSchema.safeParse({ name: 'A' }).success).toBe(false);
  });

  it('UpdateInstanceSchema permite parcial', () => {
    expect(UpdateInstanceSchema.safeParse({}).success).toBe(true);
    expect(UpdateInstanceSchema.safeParse({ name: 'Novo Nome' }).success).toBe(true);
  });

  describe('SendMessageSchema', () => {
    it('aceita número (só dígitos) e texto', () => {
      expect(SendMessageSchema.safeParse({ number: '5527999887766', text: 'oi' }).success).toBe(
        true,
      );
    });
    it('rejeita número com caracteres não numéricos', () => {
      expect(SendMessageSchema.safeParse({ number: '+55 (27) 99988', text: 'oi' }).success).toBe(
        false,
      );
    });
    it('rejeita texto vazio', () => {
      expect(SendMessageSchema.safeParse({ number: '5527999887766', text: '' }).success).toBe(false);
    });
  });
});
