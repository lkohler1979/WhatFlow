import { instancesService } from '@modules/instances/instances.service.js';
import { instancesRepository as repo } from '@modules/instances/instances.repository.js';
import { evolutionApiService as evo } from '@integrations/evolution-api/evolution-api.service.js';

jest.mock('@modules/instances/instances.repository.js');
jest.mock('@integrations/evolution-api/evolution-api.service.js');

const mockRepo = repo as jest.Mocked<typeof repo>;
const mockEvo = evo as jest.Mocked<typeof evo>;

beforeEach(() => {
  jest.clearAllMocks();
  mockRepo.upsertContact.mockResolvedValue('contact1');
  mockRepo.findOrCreateConversationId.mockResolvedValue('conv1');
  mockRepo.createOutboundMessage.mockResolvedValue({ id: 'msg1' });
  mockRepo.touchConversation.mockResolvedValue(undefined);
  mockEvo.sendText.mockResolvedValue({ key: { id: 'EVO123' } } as never);
});

describe('instancesService.sendMessage', () => {
  it('envia e persiste OUTBOUND quando a instância está CONNECTED', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue({
      id: 'i1',
      tenantId: 't1',
      evolutionKey: 'wf-x',
      status: 'CONNECTED',
    } as never);

    const res = await instancesService.sendMessage('t1', 'i1', {
      number: '5527999887766',
      text: 'olá',
    });

    expect(mockEvo.sendText).toHaveBeenCalledWith('wf-x', { number: '5527999887766', text: 'olá' });
    expect(mockRepo.upsertContact).toHaveBeenCalledWith('t1', '5527999887766');
    expect(mockRepo.findOrCreateConversationId).toHaveBeenCalledWith('t1', 'i1', 'contact1');
    expect(mockRepo.createOutboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'conv1', content: 'olá', externalId: 'EVO123' }),
    );
    expect(mockRepo.touchConversation).toHaveBeenCalledWith('conv1', 'olá');
    expect(res).toMatchObject({ messageId: 'msg1', status: 'SENT', externalId: 'EVO123' });
  });

  it('rejeita (409) quando a instância não está conectada', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue({
      id: 'i1',
      tenantId: 't1',
      evolutionKey: 'wf-x',
      status: 'QR_PENDING',
    } as never);

    await expect(
      instancesService.sendMessage('t1', 'i1', { number: '5527999887766', text: 'oi' }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'INSTANCE_NOT_CONNECTED' });
    expect(mockEvo.sendText).not.toHaveBeenCalled();
  });

  it('lança NotFound quando a instância não existe', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(null);
    await expect(
      instancesService.sendMessage('t1', 'nope', { number: '5527999887766', text: 'oi' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
