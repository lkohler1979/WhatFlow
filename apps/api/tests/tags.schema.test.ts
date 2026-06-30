import {
  AttachTagSchema,
  CreateTagSchema,
  ListTagsQuerySchema,
  UpdateTagSchema,
} from '@modules/tags/tags.schema.js';

describe('tags.schema', () => {
  it('cria tag com cor default', () => {
    const r = CreateTagSchema.safeParse({ name: 'Lead' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.name).toBe('Lead');
      expect(r.data.color).toBe('#3498DB');
    }
  });

  it('faz trim do nome e aceita cor hex válida', () => {
    const r = CreateTagSchema.safeParse({ name: '  VIP  ', color: '#ff0000' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.name).toBe('VIP');
  });

  it('rejeita nome vazio', () => {
    expect(CreateTagSchema.safeParse({ name: '   ' }).success).toBe(false);
  });

  it('rejeita cor inválida', () => {
    expect(CreateTagSchema.safeParse({ name: 'X', color: 'azul' }).success).toBe(false);
  });

  it('update exige ao menos um campo', () => {
    expect(UpdateTagSchema.safeParse({}).success).toBe(false);
    expect(UpdateTagSchema.safeParse({ name: 'Novo' }).success).toBe(true);
  });

  it('query aceita ?q= opcional', () => {
    expect(ListTagsQuerySchema.safeParse({}).success).toBe(true);
    const r = ListTagsQuerySchema.safeParse({ q: 'le' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.q).toBe('le');
  });

  it('attach exige tagId uuid', () => {
    expect(AttachTagSchema.safeParse({ tagId: 'nope' }).success).toBe(false);
    expect(
      AttachTagSchema.safeParse({ tagId: '11111111-1111-1111-1111-111111111111' }).success,
    ).toBe(true);
  });
});
