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
    email: null,
    avatarUrl: null,
    customFields: {},
    isBlocked: false,
    isOptedOut: false,
    optedOutAt: null,
    lastSeenAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    contactTags: [
      {
        contactId: '11111111-1111-1111-1111-111111111111',
        tagId: 'tag-1',
        createdAt: new Date(),
        tag: { id: 'tag-1', tenantId: 't1', name: 'Lead', color: '#3498DB', createdAt: new Date() },
      },
    ],
    ...over,
  }) as ContactWithTags;

beforeEach(() => jest.clearAllMocks());

describe('filtro de contatos por tag (T-043)', () => {
  it('repassa tagId à listagem tenant-scoped', async () => {
    mockRepo.listByTenant.mockResolvedValue({ data: [contact()], total: 1 });
    const r = await contactsService.list('t1', { tagId: 'tag-1', page: 1, pageSize: 25 });
    expect(mockRepo.listByTenant).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({ tagId: 'tag-1' }),
    );
    expect(r.total).toBe(1);
    expect(r.data[0].tags).toEqual([{ id: 'tag-1', name: 'Lead', color: '#3498DB' }]);
  });

  it('lista sem filtro quando tagId ausente', async () => {
    mockRepo.listByTenant.mockResolvedValue({ data: [], total: 0 });
    await contactsService.list('t1', { page: 1, pageSize: 25 });
    expect(mockRepo.listByTenant).toHaveBeenCalledWith(
      't1',
      expect.not.objectContaining({ tagId: expect.anything() }),
    );
  });
});
