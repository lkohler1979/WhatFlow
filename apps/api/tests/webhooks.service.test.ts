import { webhooksService } from '@modules/webhooks/webhooks.service.js';
import { webhooksRepository as repo } from '@modules/webhooks/webhooks.repository.js';
import { addJob } from '@queues/index.js';

jest.mock('@modules/webhooks/webhooks.repository.js');
jest.mock('@queues/index.js', () => ({
  __esModule: true,
  addJob: jest.fn().mockResolvedValue(undefined),
  webhookDeliveryQueue: {},
}));

const mockRepo = repo as jest.Mocked<typeof repo>;
const mockAddJob = addJob as jest.Mock;

const webhook = (over: Record<string, unknown> = {}) =>
  ({
    id: 'w1',
    tenantId: 't1',
    name: 'CRM',
    url: 'https://example.com/hook',
    secret: 'a'.repeat(32),
    events: ['MESSAGE_RECEIVED'],
    headers: {},
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }) as never;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('webhooksService.create', () => {
  it('gera secret quando não informado e não vaza o secret na view', async () => {
    mockRepo.create.mockImplementation(data => Promise.resolve(webhook(data as object)));
    const view = await webhooksService.create('t1', {
      name: 'CRM',
      url: 'https://example.com/hook',
      events: ['MESSAGE_RECEIVED'],
      headers: {},
      isActive: true,
    });
    const createArg = mockRepo.create.mock.calls[0][0] as { secret?: string };
    expect(createArg.secret).toEqual(expect.any(String));
    expect((createArg.secret as string).length).toBeGreaterThanOrEqual(32);
    expect(view).not.toHaveProperty('secret');
    expect(view.hasSecret).toBe(true);
  });

  it('respeita secret informado', async () => {
    mockRepo.create.mockImplementation(data => Promise.resolve(webhook(data as object)));
    await webhooksService.create('t1', {
      name: 'CRM',
      url: 'https://example.com/hook',
      events: ['MESSAGE_SENT'],
      secret: 'meu-secret-personalizado',
      headers: {},
      isActive: true,
    });
    expect(mockRepo.create.mock.calls[0][0]).toMatchObject({ secret: 'meu-secret-personalizado' });
  });
});

describe('webhooksService.get / update / remove', () => {
  it('get inexistente → 404', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(null);
    await expect(webhooksService.get('t1', 'w1')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('update inexistente → 404 (antes de tocar o repo)', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(null);
    await expect(webhooksService.update('t1', 'w1', { name: 'x' })).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(mockRepo.update).not.toHaveBeenCalled();
  });
});

describe('webhooksService.dispatchEvent', () => {
  it('enfileira um job por webhook ativo inscrito no evento', async () => {
    mockRepo.findActiveSubscribers.mockResolvedValue([
      webhook({ id: 'w1' }),
      webhook({ id: 'w2' }),
    ]);
    const n = await webhooksService.dispatchEvent('t1', 'MESSAGE_RECEIVED', { foo: 'bar' });
    expect(mockRepo.findActiveSubscribers).toHaveBeenCalledWith('t1', 'MESSAGE_RECEIVED');
    expect(mockAddJob).toHaveBeenCalledTimes(2);
    expect(n).toBe(2);
    const jobData = mockAddJob.mock.calls[0][2];
    expect(jobData).toMatchObject({
      webhookId: 'w1',
      tenantId: 't1',
      event: 'MESSAGE_RECEIVED',
      payload: { foo: 'bar' },
    });
  });

  it('não enfileira nada quando não há inscritos', async () => {
    mockRepo.findActiveSubscribers.mockResolvedValue([]);
    const n = await webhooksService.dispatchEvent('t1', 'CAMPAIGN_COMPLETED', {});
    expect(mockAddJob).not.toHaveBeenCalled();
    expect(n).toBe(0);
  });

  it('é best-effort: erro ao buscar inscritos não propaga', async () => {
    mockRepo.findActiveSubscribers.mockRejectedValue(new Error('db down'));
    await expect(webhooksService.dispatchEvent('t1', 'MESSAGE_RECEIVED', {})).resolves.toBe(0);
  });
});

describe('webhooksService.testWebhook', () => {
  it('pré-cria delivery e enfileira job com deliveryId', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(webhook());
    mockRepo.createDelivery.mockResolvedValue({ id: 'd1' } as never);
    const r = await webhooksService.testWebhook('t1', 'w1');
    expect(mockRepo.createDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ webhookId: 'w1', status: 'PENDING' }),
    );
    expect(mockAddJob.mock.calls[0][2]).toMatchObject({ webhookId: 'w1', deliveryId: 'd1' });
    expect(r).toEqual({ deliveryId: 'd1', enqueued: true });
  });

  it('webhook inexistente → 404', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(null);
    await expect(webhooksService.testWebhook('t1', 'w1')).rejects.toMatchObject({ statusCode: 404 });
  });
});
