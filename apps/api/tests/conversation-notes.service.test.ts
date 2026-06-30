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

const note = (over: Record<string, unknown> = {}) =>
  ({
    id: 'n1',
    conversationId: 'cv1',
    direction: 'OUTBOUND',
    type: 'TEXT',
    content: 'cliente pediu retorno amanhã',
    mediaUrl: null,
    status: 'SENT',
    externalId: null,
    isInternal: true,
    sentByAgentId: 'user-internal-1',
    timestamp: new Date(),
    ...over,
  }) as never;

beforeEach(() => {
  jest.clearAllMocks();
  mockRepo.findUserIdBySupabaseUid.mockResolvedValue('user-internal-1');
  mockRepo.createInternalNote.mockResolvedValue(note());
});

describe('messagesService.addNote (nota interna — T-040)', () => {
  it('persiste isInternal=true/OUTBOUND, NÃO chama Evolution nem toca a conversa', async () => {
    mockRepo.conversationBelongsToTenant.mockResolvedValue(true);
    const r = await messagesService.addNote(
      't1',
      'cv1',
      { text: 'cliente pediu retorno amanhã' },
      'sub-123',
    );

    expect(mockRepo.createInternalNote).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'cv1',
        content: 'cliente pediu retorno amanhã',
        sentByAgentId: 'user-internal-1',
      }),
    );
    // A nota NUNCA vai para o WhatsApp.
    expect(mockEvo.sendText).not.toHaveBeenCalled();
    // Não atualiza preview/lastMessage da conversa.
    expect(mockRepo.touchConversation).not.toHaveBeenCalled();
    expect(r).toMatchObject({ id: 'n1', direction: 'OUTBOUND', isInternal: true, status: 'SENT' });
  });

  it('emite message:new para o chat aberto refletir a nota', async () => {
    mockRepo.conversationBelongsToTenant.mockResolvedValue(true);
    await messagesService.addNote('t1', 'cv1', { text: 'nota' }, 'sub-123');
    expect(mockEmit).toHaveBeenCalledWith(
      't1',
      'message:new',
      expect.objectContaining({
        conversationId: 'cv1',
        message: expect.objectContaining({ isInternal: true }),
      }),
    );
  });

  it('404 quando a conversa não é do tenant (não persiste nada)', async () => {
    mockRepo.conversationBelongsToTenant.mockResolvedValue(false);
    await expect(
      messagesService.addNote('t1', 'cv1', { text: 'nota' }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mockRepo.createInternalNote).not.toHaveBeenCalled();
    expect(mockEvo.sendText).not.toHaveBeenCalled();
  });

  it('persiste sem sentByAgentId quando não há supabaseUid', async () => {
    mockRepo.conversationBelongsToTenant.mockResolvedValue(true);
    mockRepo.createInternalNote.mockResolvedValue(note({ sentByAgentId: null }));
    await messagesService.addNote('t1', 'cv1', { text: 'nota' });
    expect(mockRepo.findUserIdBySupabaseUid).not.toHaveBeenCalled();
    expect(mockRepo.createInternalNote).toHaveBeenCalledWith(
      expect.objectContaining({ sentByAgentId: null }),
    );
  });
});
