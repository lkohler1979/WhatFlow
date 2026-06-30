import { messagesService } from '@modules/messages/messages.service.js';
import { messagesRepository as repo } from '@modules/messages/messages.repository.js';
import { evolutionApiService as evo } from '@integrations/evolution-api/evolution-api.service.js';
import { emitToTenant } from '@core/realtime.js';

jest.mock('@modules/messages/messages.repository.js');
jest.mock('@integrations/evolution-api/evolution-api.service.js');
jest.mock('@core/realtime.js', () => ({ __esModule: true, emitToTenant: jest.fn() }));

const mockRepo = repo as jest.Mocked<typeof repo>;
const mockEvo = evo as jest.Mocked<typeof evo>;
const mockEmit = emitToTenant as jest.Mock;

const msg = (over: Record<string, unknown> = {}) =>
  ({
    id: 'm1',
    conversationId: 'cv1',
    direction: 'OUTBOUND',
    type: 'TEXT',
    content: 'olá',
    mediaUrl: null,
    status: 'SENT',
    externalId: 'EVO1',
    isInternal: false,
    sentByAgentId: null,
    timestamp: new Date(),
    ...over,
  }) as never;

beforeEach(() => {
  jest.clearAllMocks();
  mockEvo.sendText.mockResolvedValue({ key: { id: 'EVO1' } } as never);
  mockRepo.findUserIdBySupabaseUid.mockResolvedValue('user-internal-1');
  mockRepo.createOutboundMessage.mockResolvedValue(msg({ sentByAgentId: 'user-internal-1' }));
  mockRepo.touchConversation.mockResolvedValue(undefined);
});

describe('messagesService.list (cursor-based)', () => {
  it('404 quando a conversa não é do tenant', async () => {
    mockRepo.conversationBelongsToTenant.mockResolvedValue(false);
    await expect(
      messagesService.list('t1', 'cv1', { limit: 30 } as never),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('retorna nextCursor quando há mais que limit (busca limit+1)', async () => {
    mockRepo.conversationBelongsToTenant.mockResolvedValue(true);
    // limit=2 → repo retorna 3 (limit+1) para sinalizar próxima página.
    mockRepo.listByConversation.mockResolvedValue([
      msg({ id: 'a' }),
      msg({ id: 'b' }),
      msg({ id: 'c' }),
    ]);
    const r = await messagesService.list('t1', 'cv1', { limit: 2 } as never);
    expect(r.data).toHaveLength(2);
    expect(r.data.map(m => m.id)).toEqual(['a', 'b']);
    expect(r.nextCursor).toBe('b');
  });

  it('nextCursor null quando não há mais páginas', async () => {
    mockRepo.conversationBelongsToTenant.mockResolvedValue(true);
    mockRepo.listByConversation.mockResolvedValue([msg({ id: 'a' }), msg({ id: 'b' })]);
    const r = await messagesService.list('t1', 'cv1', { limit: 2 } as never);
    expect(r.data).toHaveLength(2);
    expect(r.nextCursor).toBeNull();
  });

  it('repassa cursor ao repositório', async () => {
    mockRepo.conversationBelongsToTenant.mockResolvedValue(true);
    mockRepo.listByConversation.mockResolvedValue([]);
    await messagesService.list('t1', 'cv1', { cursor: 'x', limit: 30 } as never);
    expect(mockRepo.listByConversation).toHaveBeenCalledWith('cv1', { cursor: 'x', limit: 30 });
  });
});

describe('messagesService.send (agente envia)', () => {
  const ctx = {
    id: 'cv1',
    instanceEvolutionKey: 'wf-x',
    instanceStatus: 'CONNECTED',
    contactPhone: '5527999887766',
  };

  it('envia via Evolution, persiste OUTBOUND/SENT, toca conversa e emite message:new', async () => {
    mockRepo.getSendContext.mockResolvedValue(ctx);
    const r = await messagesService.send('t1', 'cv1', { text: 'olá' }, 'sub-123');

    expect(mockEvo.sendText).toHaveBeenCalledWith('wf-x', {
      number: '5527999887766',
      text: 'olá',
    });
    expect(mockRepo.findUserIdBySupabaseUid).toHaveBeenCalledWith('sub-123', 't1');
    expect(mockRepo.createOutboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'cv1',
        content: 'olá',
        externalId: 'EVO1',
        sentByAgentId: 'user-internal-1',
      }),
    );
    expect(mockRepo.touchConversation).toHaveBeenCalledWith('cv1', 'olá');
    expect(mockEmit).toHaveBeenCalledWith(
      't1',
      'message:new',
      expect.objectContaining({ conversationId: 'cv1' }),
    );
    expect(r).toMatchObject({ id: 'm1', direction: 'OUTBOUND', status: 'SENT' });
  });

  it('404 quando a conversa não existe no tenant', async () => {
    mockRepo.getSendContext.mockResolvedValue(null);
    await expect(messagesService.send('t1', 'cv1', { text: 'oi' })).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(mockEvo.sendText).not.toHaveBeenCalled();
  });

  it('409 INSTANCE_NOT_CONNECTED quando a instância não está conectada', async () => {
    mockRepo.getSendContext.mockResolvedValue({ ...ctx, instanceStatus: 'QR_PENDING' });
    await expect(messagesService.send('t1', 'cv1', { text: 'oi' })).rejects.toMatchObject({
      statusCode: 409,
      code: 'INSTANCE_NOT_CONNECTED',
    });
    expect(mockEvo.sendText).not.toHaveBeenCalled();
  });

  it('persiste sem sentByAgentId quando não há supabaseUid', async () => {
    mockRepo.getSendContext.mockResolvedValue(ctx);
    mockRepo.createOutboundMessage.mockResolvedValue(msg({ sentByAgentId: null }));
    await messagesService.send('t1', 'cv1', { text: 'olá' });
    expect(mockRepo.findUserIdBySupabaseUid).not.toHaveBeenCalled();
    expect(mockRepo.createOutboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({ sentByAgentId: null }),
    );
  });
});
