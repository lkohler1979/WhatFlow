import { campaignsService } from '@modules/campaigns/campaigns.service.js';
import { campaignsRepository as repo } from '@modules/campaigns/campaigns.repository.js';
import { contactsService } from '@modules/contacts/contacts.service.js';
import { addJob } from '@queues/index.js';

jest.mock('@modules/campaigns/campaigns.repository.js');
jest.mock('@modules/contacts/contacts.service.js', () => ({
  __esModule: true,
  contactsService: { bulkUpsertByPhones: jest.fn() },
}));
jest.mock('@queues/index.js', () => ({
  __esModule: true,
  addJob: jest.fn().mockResolvedValue(undefined),
  campaignQueue: {},
}));

const mockRepo = repo as jest.Mocked<typeof repo>;
const mockAddJob = addJob as jest.Mock;
const mockBulkByPhones = contactsService.bulkUpsertByPhones as jest.Mock;

const campaign = (over: Record<string, unknown> = {}) =>
  ({
    id: 'c1',
    tenantId: 't1',
    instanceId: 'i1',
    name: 'Promo',
    description: null,
    status: 'DRAFT',
    messageType: 'TEXT',
    messageContent: 'oi',
    mediaUrl: null,
    mediaCaption: null,
    scheduledAt: null,
    startedAt: null,
    completedAt: null,
    delayMinMs: 3000,
    delayMaxMs: 8000,
    totalContacts: 1,
    sentCount: 0,
    deliveredCount: 0,
    readCount: 0,
    failedCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }) as never;

beforeEach(() => {
  jest.clearAllMocks();
  mockRepo.update.mockResolvedValue(1);
  mockRepo.updateStatus.mockResolvedValue(1);
  mockRepo.remove.mockResolvedValue(1);
  mockRepo.instanceBelongsToTenant.mockResolvedValue(true);
  mockRepo.resolveContacts.mockResolvedValue([{ id: 'ct1', phone: '5527999887766' }]);
  mockRepo.createWithContacts.mockImplementation(data =>
    Promise.resolve(campaign(data as object)),
  );
});

describe('campaignsService.create', () => {
  const dto = {
    name: 'Promo',
    instanceId: 'i1',
    messageType: 'TEXT' as const,
    messageContent: 'oi',
    contactIds: ['ct1'],
    phones: [] as string[],
    delayMinMs: 3000,
    delayMaxMs: 8000,
  };

  it('cria DRAFT sem agendamento', async () => {
    const r = await campaignsService.create('t1', dto);
    expect(r.status).toBe('DRAFT');
    expect(mockRepo.createWithContacts).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 't1', status: 'DRAFT' }),
      [{ contactId: 'ct1', phone: '5527999887766' }],
    );
  });

  it('cria SCHEDULED com agendamento futuro', async () => {
    const future = new Date(Date.now() + 3_600_000);
    const r = await campaignsService.create('t1', { ...dto, scheduledAt: future });
    expect(r.status).toBe('SCHEDULED');
  });

  it('404 quando instância não é do tenant', async () => {
    mockRepo.instanceBelongsToTenant.mockResolvedValue(false);
    await expect(campaignsService.create('t1', dto)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('422 quando nenhum contato válido', async () => {
    mockRepo.resolveContacts.mockResolvedValue([]);
    await expect(campaignsService.create('t1', dto)).rejects.toMatchObject({
      statusCode: 422,
      code: 'NO_VALID_CONTACTS',
    });
  });

  it('resolve lista por phones (CSV) via find-or-create e associa (T-035)', async () => {
    mockRepo.resolveContacts.mockResolvedValue([]);
    mockBulkByPhones.mockResolvedValue({
      contacts: [
        { id: 'p1', phone: '5527999887766' },
        { id: 'p2', phone: '5527999776655' },
      ],
      total: 2,
      valid: 2,
      invalid: 0,
      duplicates: 0,
    });

    await campaignsService.create('t1', {
      ...dto,
      contactIds: [],
      phones: ['5527999887766', '5527999776655'],
    });

    expect(mockBulkByPhones).toHaveBeenCalledWith('t1', ['5527999887766', '5527999776655']);
    expect(mockRepo.createWithContacts).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 't1' }),
      [
        { contactId: 'p1', phone: '5527999887766' },
        { contactId: 'p2', phone: '5527999776655' },
      ],
    );
  });

  it('dedupe entre contactIds e phones (mesmo contato não duplica)', async () => {
    mockRepo.resolveContacts.mockResolvedValue([{ id: 'ct1', phone: '5527999887766' }]);
    mockBulkByPhones.mockResolvedValue({
      contacts: [
        { id: 'ct1', phone: '5527999887766' }, // já presente via contactIds
        { id: 'p2', phone: '5527999776655' },
      ],
      total: 2,
      valid: 2,
      invalid: 0,
      duplicates: 0,
    });

    await campaignsService.create('t1', {
      ...dto,
      contactIds: ['ct1'],
      phones: ['5527999887766', '5527999776655'],
    });

    expect(mockRepo.createWithContacts).toHaveBeenCalledWith(expect.anything(), [
      { contactId: 'ct1', phone: '5527999887766' },
      { contactId: 'p2', phone: '5527999776655' },
    ]);
  });
});

describe('campaignsService transições de status', () => {
  it('start: DRAFT → RUNNING e enfileira job', async () => {
    mockRepo.findByIdInTenant
      .mockResolvedValueOnce(campaign({ status: 'DRAFT' }))
      .mockResolvedValueOnce(campaign({ status: 'RUNNING' }));
    const r = await campaignsService.start('t1', 'c1');
    expect(mockRepo.updateStatus).toHaveBeenCalledWith(
      'c1',
      't1',
      'RUNNING',
      expect.objectContaining({ startedAt: expect.any(Date) }),
    );
    expect(mockAddJob).toHaveBeenCalled();
    expect(r.status).toBe('RUNNING');
  });

  it('start: PAUSED → RUNNING permitido', async () => {
    mockRepo.findByIdInTenant
      .mockResolvedValueOnce(campaign({ status: 'PAUSED' }))
      .mockResolvedValueOnce(campaign({ status: 'RUNNING' }));
    await campaignsService.start('t1', 'c1');
    expect(mockRepo.updateStatus).toHaveBeenCalledWith('c1', 't1', 'RUNNING', expect.anything());
  });

  it('start: COMPLETED → 409 INVALID_CAMPAIGN_STATE', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(campaign({ status: 'COMPLETED' }));
    await expect(campaignsService.start('t1', 'c1')).rejects.toMatchObject({
      statusCode: 409,
      code: 'INVALID_CAMPAIGN_STATE',
    });
    expect(mockRepo.updateStatus).not.toHaveBeenCalled();
  });

  it('pause: RUNNING → PAUSED', async () => {
    mockRepo.findByIdInTenant
      .mockResolvedValueOnce(campaign({ status: 'RUNNING' }))
      .mockResolvedValueOnce(campaign({ status: 'PAUSED' }));
    const r = await campaignsService.pause('t1', 'c1');
    expect(mockRepo.updateStatus).toHaveBeenCalledWith('c1', 't1', 'PAUSED');
    expect(r.status).toBe('PAUSED');
  });

  it('pause: DRAFT → 409', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(campaign({ status: 'DRAFT' }));
    await expect(campaignsService.pause('t1', 'c1')).rejects.toMatchObject({
      statusCode: 409,
      code: 'INVALID_CAMPAIGN_STATE',
    });
  });

  it('cancel: RUNNING → CANCELLED', async () => {
    mockRepo.findByIdInTenant
      .mockResolvedValueOnce(campaign({ status: 'RUNNING' }))
      .mockResolvedValueOnce(campaign({ status: 'CANCELLED' }));
    const r = await campaignsService.cancel('t1', 'c1');
    expect(mockRepo.updateStatus).toHaveBeenCalledWith(
      'c1',
      't1',
      'CANCELLED',
      expect.objectContaining({ completedAt: expect.any(Date) }),
    );
    expect(r.status).toBe('CANCELLED');
  });

  it('cancel: CANCELLED (terminal) → 409', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(campaign({ status: 'CANCELLED' }));
    await expect(campaignsService.cancel('t1', 'c1')).rejects.toMatchObject({
      statusCode: 409,
      code: 'INVALID_CAMPAIGN_STATE',
    });
  });

  it('update: RUNNING → 409 (não editável)', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(campaign({ status: 'RUNNING' }));
    await expect(campaignsService.update('t1', 'c1', { name: 'x' })).rejects.toMatchObject({
      statusCode: 409,
      code: 'INVALID_CAMPAIGN_STATE',
    });
  });

  it('remove: COMPLETED → 409 (preserva histórico)', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(campaign({ status: 'COMPLETED' }));
    await expect(campaignsService.remove('t1', 'c1')).rejects.toMatchObject({
      statusCode: 409,
      code: 'INVALID_CAMPAIGN_STATE',
    });
    expect(mockRepo.remove).not.toHaveBeenCalled();
  });

  it('get: inexistente → 404', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(null);
    await expect(campaignsService.get('t1', 'c1')).rejects.toMatchObject({ statusCode: 404 });
  });
});
