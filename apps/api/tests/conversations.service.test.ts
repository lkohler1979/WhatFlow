import { conversationsService } from '@modules/conversations/conversations.service.js';
import { conversationsRepository as repo } from '@modules/conversations/conversations.repository.js';
import { emitToTenant } from '@core/realtime.js';

jest.mock('@modules/conversations/conversations.repository.js');
jest.mock('@core/realtime.js', () => ({
  __esModule: true,
  emitToTenant: jest.fn(),
}));

const mockRepo = repo as jest.Mocked<typeof repo>;
const mockEmit = emitToTenant as jest.Mock;

const conv = (over: Record<string, unknown> = {}) =>
  ({
    id: 'cv1',
    tenantId: 't1',
    instanceId: 'i1',
    contactId: 'ct1',
    assignedTo: null,
    status: 'OPEN',
    botActive: true,
    unreadCount: 3,
    lastMessageAt: new Date(),
    lastMessagePreview: 'oi',
    resolvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    contact: { id: 'ct1', name: 'João', phone: '5527999887766', avatarUrl: null },
    ...over,
  }) as never;

beforeEach(() => {
  jest.clearAllMocks();
  mockRepo.update.mockResolvedValue(1);
  mockRepo.markRead.mockResolvedValue(1);
  mockRepo.userBelongsToTenant.mockResolvedValue(true);
});

describe('conversationsService.list', () => {
  it('repassa filtros e paginação ao repositório e mapeia para DTO', async () => {
    mockRepo.listByTenant.mockResolvedValue({ data: [conv()], total: 1 });
    const r = await conversationsService.list('t1', {
      status: 'OPEN',
      instanceId: 'i1',
      botActive: true,
      search: 'joão',
      page: 2,
      pageSize: 10,
    } as never);

    expect(mockRepo.listByTenant).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({
        status: 'OPEN',
        instanceId: 'i1',
        botActive: true,
        search: 'joão',
        page: 2,
        pageSize: 10,
      }),
    );
    expect(r.total).toBe(1);
    expect(r.page).toBe(2);
    expect(r.data[0]).toMatchObject({
      id: 'cv1',
      assignedToUserId: null,
      contact: { name: 'João', phone: '5527999887766' },
    });
  });

  it('repassa contactId ao repositório (histórico do contato — T-042)', async () => {
    mockRepo.listByTenant.mockResolvedValue({ data: [conv()], total: 1 });
    await conversationsService.list('t1', {
      contactId: 'ct1',
      page: 1,
      pageSize: 20,
    } as never);

    expect(mockRepo.listByTenant).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({ contactId: 'ct1' }),
    );
  });
});

describe('conversationsService.get', () => {
  it('404 quando não existe no tenant', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(null);
    await expect(conversationsService.get('t1', 'cv1')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('conversationsService.update', () => {
  it('atribui agente válido e emite evento', async () => {
    mockRepo.findByIdInTenant
      .mockResolvedValueOnce(conv())
      .mockResolvedValueOnce(conv({ assignedTo: 'u9' }));
    const r = await conversationsService.update('t1', 'cv1', { assignedToUserId: 'u9' });

    expect(mockRepo.userBelongsToTenant).toHaveBeenCalledWith('u9', 't1');
    expect(mockRepo.update).toHaveBeenCalledWith(
      'cv1',
      't1',
      expect.objectContaining({ assignedUser: { connect: { id: 'u9' } } }),
    );
    expect(r.assignedToUserId).toBe('u9');
    expect(mockEmit).toHaveBeenCalledWith('t1', 'conversation:updated', expect.anything());
  });

  it('desatribui com assignedToUserId null (disconnect)', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(conv());
    await conversationsService.update('t1', 'cv1', { assignedToUserId: null });
    expect(mockRepo.update).toHaveBeenCalledWith(
      'cv1',
      't1',
      expect.objectContaining({ assignedUser: { disconnect: true } }),
    );
  });

  it('422 quando o agente não pertence ao tenant', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(conv());
    mockRepo.userBelongsToTenant.mockResolvedValue(false);
    await expect(
      conversationsService.update('t1', 'cv1', { assignedToUserId: 'uX' }),
    ).rejects.toMatchObject({ statusCode: 422, code: 'INVALID_ASSIGNEE' });
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it('status RESOLVED grava resolvedAt', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(conv());
    await conversationsService.update('t1', 'cv1', { status: 'RESOLVED' });
    expect(mockRepo.update).toHaveBeenCalledWith(
      'cv1',
      't1',
      expect.objectContaining({ status: 'RESOLVED', resolvedAt: expect.any(Date) }),
    );
  });
});

describe('conversationsService.markRead', () => {
  it('zera unreadCount e emite conversation:read', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(conv({ unreadCount: 0 }));
    const r = await conversationsService.markRead('t1', 'cv1');
    expect(mockRepo.markRead).toHaveBeenCalledWith('cv1', 't1');
    expect(r.unreadCount).toBe(0);
    expect(mockEmit).toHaveBeenCalledWith('t1', 'conversation:read', { id: 'cv1', unreadCount: 0 });
  });
});
