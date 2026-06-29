import {
  CreateContactSchema,
  ImportContactsSchema,
  ListContactsQuerySchema,
  UpdateContactSchema,
} from '@modules/contacts/contacts.schema.js';

describe('contacts.schema', () => {
  it('normaliza telefone na criação', () => {
    const r = CreateContactSchema.safeParse({
      phone: '+55 (27) 99988-7766',
      name: 'Maria',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.phone).toBe('5527999887766');
  });

  it('rejeita telefone inválido', () => {
    expect(CreateContactSchema.safeParse({ phone: '123' }).success).toBe(false);
  });

  it('permite update parcial', () => {
    expect(UpdateContactSchema.safeParse({ name: 'Novo nome' }).success).toBe(true);
  });

  it('aplica defaults de paginação', () => {
    const r = ListContactsQuerySchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.page).toBe(1);
      expect(r.data.pageSize).toBe(25);
    }
  });

  it('exige conteúdo no import CSV', () => {
    expect(ImportContactsSchema.safeParse({ csv: '' }).success).toBe(false);
  });
});
