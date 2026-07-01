import { instancesService } from '@modules/instances/instances.service.js';
import { instancesRepository as repo } from '@modules/instances/instances.repository.js';
import { evolutionApiService as evo } from '@integrations/evolution-api/evolution-api.service.js';
import { config } from '@core/config.js';

jest.mock('@modules/instances/instances.repository.js');
jest.mock('@integrations/evolution-api/evolution-api.service.js');

const mockRepo = repo as jest.Mocked<typeof repo>;
const mockEvo = evo as jest.Mocked<typeof evo>;

const inst = (over: Record<string, unknown> = {}) =>
  ({
    id: 'i1',
    tenantId: 't1',
    name: 'Vendas',
    phone: null,
    evolutionKey: 'wf-vendas-abc',
    status: 'PENDING',
    qrCode: null,
    connectedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...over,
  }) as never;

beforeEach(() => {
  jest.clearAllMocks();
  (config as { WEBHOOK_BASE_URL: string }).WEBHOOK_BASE_URL = '';
});

describe('instancesService.list', () => {
  it('mapeia para DTO', async () => {
    mockRepo.listByTenant.mockResolvedValue([inst({ status: 'CONNECTED' })]);
    const r = await instancesService.list('t1');
    expect(r[0]).toMatchObject({ id: 'i1', name: 'Vendas', status: 'CONNECTED' });
  });
});

describe('instancesService.create', () => {
  it('cria na Evolution e persiste (sem webhook quando WEBHOOK_BASE_URL vazio)', async () => {
    mockEvo.createInstance.mockResolvedValue({ instance: { state: 'connecting' } } as never);
    mockRepo.create.mockResolvedValue(inst({ status: 'QR_PENDING' }));
    const r = await instancesService.create('t1', { name: 'Vendas' } as never);
    expect(mockEvo.createInstance).toHaveBeenCalled();
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 't1', status: 'QR_PENDING' }),
    );
    expect(mockEvo.setWebhook).not.toHaveBeenCalled();
    expect(r.status).toBe('QR_PENDING');
  });

  it('registra webhook quando WEBHOOK_BASE_URL definido', async () => {
    (config as { WEBHOOK_BASE_URL: string }).WEBHOOK_BASE_URL = 'http://api:3000/v1/';
    mockEvo.createInstance.mockResolvedValue({ status: 'open' } as never);
    mockRepo.create.mockResolvedValue(inst({ id: 'i1', status: 'CONNECTED' }));
    mockEvo.setWebhook.mockResolvedValue(undefined as never);
    mockRepo.update.mockResolvedValue(1);
    await instancesService.create('t1', { name: 'Vendas' } as never);
    // aguarda a cadeia .then encadeada
    await new Promise(r => setImmediate(r));
    expect(mockEvo.setWebhook).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('/webhooks/evolution/'),
      expect.any(Array),
    );
  });

  it('não quebra se setWebhook falhar', async () => {
    (config as { WEBHOOK_BASE_URL: string }).WEBHOOK_BASE_URL = 'http://api:3000/v1';
    mockEvo.createInstance.mockResolvedValue({ status: 'open' } as never);
    mockRepo.create.mockResolvedValue(inst());
    mockEvo.setWebhook.mockRejectedValue(new Error('net'));
    await expect(instancesService.create('t1', { name: 'X' } as never)).resolves.toBeDefined();
    await new Promise(r => setImmediate(r));
  });
});

describe('instancesService.get', () => {
  it('404 quando não existe', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(null);
    await expect(instancesService.get('t1', 'i1')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('sincroniza status quando muda', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(inst({ status: 'QR_PENDING' }));
    mockEvo.getConnectionState.mockResolvedValue({ instance: { state: 'open' } } as never);
    mockRepo.update.mockResolvedValue(1);
    const r = await instancesService.get('t1', 'i1');
    expect(mockRepo.update).toHaveBeenCalledWith(
      'i1',
      't1',
      expect.objectContaining({ status: 'CONNECTED' }),
    );
    expect(r.status).toBe('CONNECTED');
  });

  it('não quebra se a Evolution falhar ao sincronizar', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(inst({ status: 'CONNECTED' }));
    mockEvo.getConnectionState.mockRejectedValue(new Error('down'));
    const r = await instancesService.get('t1', 'i1');
    expect(r.status).toBe('CONNECTED');
    expect(mockRepo.update).not.toHaveBeenCalled();
  });
});

describe('instancesService.getQrCode', () => {
  it('404 quando não existe', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(null);
    await expect(instancesService.getQrCode('t1', 'i1')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('conecta e devolve base64 do QR', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(inst());
    mockEvo.connect.mockResolvedValue({ qrcode: { base64: 'data:img' }, state: 'connecting' } as never);
    mockRepo.update.mockResolvedValue(1);
    const r = await instancesService.getQrCode('t1', 'i1');
    expect(r.qrCode).toBe('data:img');
    expect(r.status).toBe('QR_PENDING');
  });
});

describe('instancesService.remove', () => {
  it('404 quando não existe', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(null);
    await expect(instancesService.remove('t1', 'i1')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('remove na Evolution e no banco', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(inst());
    mockEvo.deleteInstance.mockResolvedValue(undefined as never);
    mockRepo.remove.mockResolvedValue(1);
    await instancesService.remove('t1', 'i1');
    expect(mockRepo.remove).toHaveBeenCalledWith('i1', 't1');
  });

  it('não quebra se a Evolution falhar ao remover', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(inst());
    mockEvo.deleteInstance.mockRejectedValue(new Error('x'));
    mockRepo.remove.mockResolvedValue(1);
    await expect(instancesService.remove('t1', 'i1')).resolves.toBeUndefined();
  });
});

describe('instancesService.sendMessage', () => {
  it('404 quando não existe', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(null);
    await expect(
      instancesService.sendMessage('t1', 'i1', { number: '55', text: 'oi' } as never),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('409 quando não está conectada', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(inst({ status: 'PENDING' }));
    await expect(
      instancesService.sendMessage('t1', 'i1', { number: '55', text: 'oi' } as never),
    ).rejects.toMatchObject({ statusCode: 409, code: 'INSTANCE_NOT_CONNECTED' });
  });

  it('envia, persiste OUTBOUND e toca conversa', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(inst({ status: 'CONNECTED' }));
    mockEvo.sendText.mockResolvedValue({ key: { id: 'EVO9' } } as never);
    mockRepo.upsertContact.mockResolvedValue('c1');
    mockRepo.findOrCreateConversationId.mockResolvedValue('cv1');
    mockRepo.createOutboundMessage.mockResolvedValue({ id: 'm1' } as never);
    mockRepo.touchConversation.mockResolvedValue(undefined);
    const r = await instancesService.sendMessage('t1', 'i1', {
      number: '5527999',
      text: 'oi',
    } as never);
    expect(r).toEqual({ messageId: 'm1', status: 'SENT', externalId: 'EVO9' });
    expect(mockRepo.touchConversation).toHaveBeenCalledWith('cv1', 'oi');
  });
});
