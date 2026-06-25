import { webhookReceiverService } from '@modules/webhook-receiver/webhook-receiver.service.js';
import { webhookReceiverRepository as repo } from '@modules/webhook-receiver/webhook-receiver.repository.js';

jest.mock('@modules/webhook-receiver/webhook-receiver.repository.js');

const mockRepo = repo as jest.Mocked<typeof repo>;

beforeEach(() => {
  jest.clearAllMocks();
  mockRepo.findInstanceByKey.mockResolvedValue({ id: 'i1', tenantId: 't1' } as never);
  mockRepo.upsertContact.mockResolvedValue('contact1');
  mockRepo.findOrCreateConversation.mockResolvedValue({ id: 'c1' } as never);
  mockRepo.createInboundMessage.mockResolvedValue({} as never);
});

describe('webhookReceiverService.handle', () => {
  it('ignora instância desconhecida', async () => {
    mockRepo.findInstanceByKey.mockResolvedValueOnce(null);
    await webhookReceiverService.handle('nope', 'connection.update', { state: 'open' });
    expect(mockRepo.updateInstanceStatus).not.toHaveBeenCalled();
  });

  it('connection.update open → CONNECTED', async () => {
    await webhookReceiverService.handle('k', 'connection.update', { state: 'open' });
    expect(mockRepo.updateInstanceStatus).toHaveBeenCalledWith('i1', 'CONNECTED');
  });

  it('connection.update close → DISCONNECTED', async () => {
    await webhookReceiverService.handle('k', 'connection.update', { state: 'close' });
    expect(mockRepo.updateInstanceStatus).toHaveBeenCalledWith('i1', 'DISCONNECTED');
  });

  it('normaliza evento CONNECTION_UPDATE (uppercase/underscore)', async () => {
    await webhookReceiverService.handle('k', 'CONNECTION_UPDATE', { state: 'connecting' });
    expect(mockRepo.updateInstanceStatus).toHaveBeenCalledWith('i1', 'QR_PENDING');
  });

  it('qrcode.updated salva o base64', async () => {
    await webhookReceiverService.handle('k', 'qrcode.updated', { qrcode: { base64: 'data:img' } });
    expect(mockRepo.updateInstanceQr).toHaveBeenCalledWith('i1', 'data:img');
  });

  it('messages.upsert (recebida) persiste contato/conversa/mensagem', async () => {
    await webhookReceiverService.handle('k', 'messages.upsert', {
      key: { remoteJid: '5527999@s.whatsapp.net', fromMe: false, id: 'MSG1' },
      message: { conversation: 'olá' },
      pushName: 'Fulano',
    });
    expect(mockRepo.upsertContact).toHaveBeenCalledWith('t1', '5527999', 'Fulano');
    expect(mockRepo.findOrCreateConversation).toHaveBeenCalledWith('t1', 'i1', 'contact1');
    expect(mockRepo.createInboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'c1', externalId: 'MSG1', content: 'olá' }),
    );
    expect(mockRepo.touchConversation).toHaveBeenCalledWith('c1', 'olá');
  });

  it('messages.upsert fromMe=true é ignorada', async () => {
    await webhookReceiverService.handle('k', 'messages.upsert', {
      key: { remoteJid: '5527999@s.whatsapp.net', fromMe: true, id: 'X' },
      message: { conversation: 'eu enviei' },
    });
    expect(mockRepo.upsertContact).not.toHaveBeenCalled();
  });

  it('ignora mensagens de grupo (@g.us)', async () => {
    await webhookReceiverService.handle('k', 'messages.upsert', {
      key: { remoteJid: '123456@g.us', fromMe: false, id: 'G1' },
      message: { conversation: 'grupo' },
    });
    expect(mockRepo.upsertContact).not.toHaveBeenCalled();
  });
});
