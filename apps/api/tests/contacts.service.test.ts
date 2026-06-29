import { contactsService } from '@modules/contacts/contacts.service.js';
import {
  contactsRepository as repo,
  type ContactWithTags,
} from '@modules/contacts/contacts.repository.js';

jest.mock('@modules/contacts/contacts.repository.js');

const mockRepo = repo as jest.Mocked<typeof repo>;

const contact = (over: Partial<ContactWithTags> = {}) =>
  ({
    id: '11111111-1111-1111-1111-111111111111',
    tenantId: 't1',
    phone: '5527999887766',
    name: 'Maria',
    email: 'maria@example.com',
    avatarUrl: null,
    customFields: {},
    isBlocked: false,
    isOptedOut: false,
    optedOutAt: null,
    lastSeenAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    contactTags: [],
    ...over,
  }) as ContactWithTags;

beforeEach(() => {
  jest.clearAllMocks();
  mockRepo.countTagsInTenant.mockResolvedValue(0);
  mockRepo.findByPhoneInTenant.mockResolvedValue(null);
});

describe('contactsService.create', () => {
  it('cria contato tenant-scoped e retorna DTO', async () => {
    mockRepo.create.mockResolvedValue(contact());
    const r = await contactsService.create('t1', {
      phone: '5527999887766',
      name: 'Maria',
      customFields: {},
      isBlocked: false,
      isOptedOut: false,
      tagIds: [],
    });
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 't1', phone: '5527999887766' }),
      [],
    );
    expect(r.phone).toBe('5527999887766');
  });

  it('rejeita telefone duplicado no tenant', async () => {
    mockRepo.findByPhoneInTenant.mockResolvedValue(contact() as never);
    await expect(
      contactsService.create('t1', {
        phone: '5527999887766',
        customFields: {},
        isBlocked: false,
        isOptedOut: false,
        tagIds: [],
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('contactsService.importCsv', () => {
  it('importa válidos e reporta inválidos/duplicados', async () => {
    mockRepo.bulkUpsert.mockResolvedValue({ created: 1, updated: 1 });
    const csv = [
      'phone,name,email,origem',
      '5527999887766,Maria,maria@example.com,site',
      '5527999776655,Joao,joao@example.com,evento',
      '123,Ana,ana@example.com,site',
      '5527999887766,Duplicado,dup@example.com,site',
    ].join('\n');

    const r = await contactsService.importCsv('t1', { csv });

    expect(mockRepo.bulkUpsert).toHaveBeenCalledWith('t1', [
      {
        phone: '5527999887766',
        name: 'Maria',
        email: 'maria@example.com',
        customFields: { origem: 'site' },
        line: 2,
      },
      {
        phone: '5527999776655',
        name: 'Joao',
        email: 'joao@example.com',
        customFields: { origem: 'evento' },
        line: 3,
      },
    ]);
    expect(r).toMatchObject({ total: 4, imported: 2, created: 1, updated: 1, failed: 2 });
  });
});

describe('contactsService.export', () => {
  it('gera CSV com contatos filtrados', async () => {
    mockRepo.exportByTenant.mockResolvedValue([contact()]);
    const csv = await contactsService.export('t1', { page: 1, pageSize: 25 });
    expect(csv).toContain('phone,name,email');
    expect(csv).toContain('5527999887766,Maria,maria@example.com');
  });
});
