import { createHmac } from 'node:crypto';
import type { Job } from 'bullmq';
import axios from 'axios';
import {
  webhookDeliveryProcessor,
  signPayload,
  type WebhookDeliveryJobData,
} from '@queues/processors/webhook-delivery.processor.js';
import { webhooksRepository as repo } from '@modules/webhooks/webhooks.repository.js';

jest.mock('axios');
jest.mock('@modules/webhooks/webhooks.repository.js');

const mockAxios = axios as jest.Mocked<typeof axios>;
const mockRepo = repo as jest.Mocked<typeof repo>;

const SECRET = 'a'.repeat(32);

const webhook = (over: Record<string, unknown> = {}) =>
  ({
    id: 'w1',
    tenantId: 't1',
    name: 'CRM',
    url: 'https://example.com/hook',
    secret: SECRET,
    events: ['MESSAGE_RECEIVED'],
    headers: { 'X-Custom': 'abc' },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }) as never;

const job = (
  data: Partial<WebhookDeliveryJobData> = {},
  opts: { attemptsMade?: number; attempts?: number } = {},
): Job<WebhookDeliveryJobData> =>
  ({
    data: {
      webhookId: 'w1',
      tenantId: 't1',
      event: 'MESSAGE_RECEIVED',
      payload: { foo: 'bar' },
      ...data,
    },
    attemptsMade: opts.attemptsMade ?? 0,
    opts: { attempts: opts.attempts ?? 5 },
  }) as Job<WebhookDeliveryJobData>;

beforeEach(() => {
  jest.clearAllMocks();
  mockRepo.findByIdInTenant.mockResolvedValue(webhook());
  mockRepo.createDelivery.mockResolvedValue({ id: 'd1' } as never);
  mockRepo.updateDelivery.mockResolvedValue(undefined);
});

describe('webhookDeliveryProcessor', () => {
  it('faz POST com header HMAC correto e grava delivery SUCCESS com durationMs', async () => {
    mockAxios.post.mockResolvedValue({ status: 200, data: { ok: true } } as never);

    const result = await webhookDeliveryProcessor(job());

    expect(mockAxios.post).toHaveBeenCalledTimes(1);
    const [url, body, cfg] = mockAxios.post.mock.calls[0] as [
      string,
      Record<string, unknown>,
      { headers: Record<string, string> },
    ];
    expect(url).toBe('https://example.com/hook');
    expect(body).toMatchObject({ event: 'MESSAGE_RECEIVED', tenantId: 't1', data: { foo: 'bar' } });

    // O HMAC do header deve bater com sha256 do corpo JSON exato enviado.
    const expectedSig = signPayload(SECRET, JSON.stringify(body));
    expect(cfg.headers['X-WhatFlow-Signature']).toBe(expectedSig);
    expect(cfg.headers['X-WhatFlow-Signature']).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(cfg.headers['X-Custom']).toBe('abc'); // headers customizados preservados

    // Delivery gravado como SUCCESS com httpStatus e durationMs no payload.
    expect(mockRepo.updateDelivery).toHaveBeenCalledWith(
      'd1',
      expect.objectContaining({
        status: 'SUCCESS',
        httpStatus: 200,
        attemptCount: 1,
        deliveredAt: expect.any(Date),
        payload: expect.objectContaining({ durationMs: expect.any(Number) }),
      }),
    );
    expect(result.status).toBe(200);
  });

  it('signPayload é determinístico e usa sha256(secret, body)', () => {
    const raw = JSON.stringify({ a: 1 });
    const expected = `sha256=${createHmac('sha256', SECRET).update(raw).digest('hex')}`;
    expect(signPayload(SECRET, raw)).toBe(expected);
  });

  it('status ≥400 lança (retry) e grava RETRYING quando ainda há tentativas', async () => {
    mockAxios.post.mockResolvedValue({ status: 500, data: 'boom' } as never);

    await expect(webhookDeliveryProcessor(job({}, { attemptsMade: 0, attempts: 5 }))).rejects.toThrow(
      /failed/i,
    );
    expect(mockRepo.updateDelivery).toHaveBeenCalledWith(
      'd1',
      expect.objectContaining({ status: 'RETRYING', httpStatus: 500, attemptCount: 1 }),
    );
  });

  it('na última tentativa grava FAILED e ainda lança', async () => {
    mockAxios.post.mockResolvedValue({ status: 502, data: 'down' } as never);

    await expect(
      webhookDeliveryProcessor(job({}, { attemptsMade: 4, attempts: 5 })),
    ).rejects.toThrow();
    expect(mockRepo.updateDelivery).toHaveBeenCalledWith(
      'd1',
      expect.objectContaining({ status: 'FAILED', attemptCount: 5 }),
    );
  });

  it('erro de rede (sem response) lança para retry', async () => {
    mockAxios.post.mockRejectedValue(Object.assign(new Error('ECONNREFUSED'), { isAxiosError: true }));

    await expect(webhookDeliveryProcessor(job())).rejects.toThrow();
    expect(mockRepo.updateDelivery).toHaveBeenCalledWith(
      'd1',
      expect.objectContaining({ status: 'RETRYING' }),
    );
  });

  it('usa deliveryId pré-criado (teste) e não cria outro delivery', async () => {
    mockAxios.post.mockResolvedValue({ status: 204, data: '' } as never);

    await webhookDeliveryProcessor(job({ deliveryId: 'pre-1' }));

    expect(mockRepo.createDelivery).not.toHaveBeenCalled();
    expect(mockRepo.updateDelivery).toHaveBeenCalledWith('pre-1', expect.objectContaining({
      status: 'SUCCESS',
    }));
  });

  it('webhook inexistente: não faz POST e não lança (sem retry)', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(null);

    const result = await webhookDeliveryProcessor(job());

    expect(mockAxios.post).not.toHaveBeenCalled();
    expect(result.status).toBe(0);
  });

  it('webhook sem secret: não envia header de assinatura', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(webhook({ secret: null }));
    mockAxios.post.mockResolvedValue({ status: 200, data: 'ok' } as never);

    await webhookDeliveryProcessor(job());

    const cfg = mockAxios.post.mock.calls[0][2] as { headers: Record<string, string> };
    expect(cfg.headers['X-WhatFlow-Signature']).toBeUndefined();
  });
});
