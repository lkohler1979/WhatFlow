import type { Job } from 'bullmq';
import { campaignProcessor, type CampaignJobData } from '@queues/processors/campaign.processor.js';
import { campaignsRepository as repo } from '@modules/campaigns/campaigns.repository.js';
import { evolutionApiService } from '@integrations/evolution-api/evolution-api.service.js';
import { emitToTenant } from '@core/realtime.js';

jest.mock('@modules/campaigns/campaigns.repository.js');
jest.mock('@integrations/evolution-api/evolution-api.service.js', () => ({
  __esModule: true,
  evolutionApiService: { sendText: jest.fn(), sendMedia: jest.fn() },
}));
jest.mock('@core/realtime.js', () => ({
  __esModule: true,
  emitToTenant: jest.fn(),
}));

const mockRepo = repo as jest.Mocked<typeof repo>;
const mockSendText = evolutionApiService.sendText as jest.Mock;
const mockSendMedia = evolutionApiService.sendMedia as jest.Mock;
const mockEmit = emitToTenant as jest.Mock;

const TENANT = 't1';
const CAMPAIGN_ID = 'c1';

const campaign = (over: Record<string, unknown> = {}) =>
  ({
    id: CAMPAIGN_ID,
    tenantId: TENANT,
    instanceId: 'i1',
    name: 'Promo',
    description: null,
    status: 'RUNNING',
    messageType: 'TEXT',
    messageContent: 'oi',
    mediaUrl: null,
    mediaCaption: null,
    scheduledAt: null,
    startedAt: new Date(),
    completedAt: null,
    delayMinMs: 1000,
    delayMaxMs: 2000,
    totalContacts: 3,
    sentCount: 0,
    deliveredCount: 0,
    readCount: 0,
    failedCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }) as never;

const contacts = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `cc${i}`,
    phone: `552799900000${i}`,
    contactId: `ct${i}`,
  }));

const job = (): Job<CampaignJobData> =>
  ({ data: { campaignId: CAMPAIGN_ID, tenantId: TENANT } }) as Job<CampaignJobData>;

/** Roda o processor com fake timers, resolvendo cada sleep entre envios. */
async function runWithTimers(): Promise<{
  sent: number;
  failed: number;
  total: number;
  status: string;
}> {
  const promise = campaignProcessor(job());
  // Drena microtasks + timers até o processor resolver.
  for (let i = 0; i < 50; i += 1) {
    await Promise.resolve();
    jest.runOnlyPendingTimers();
  }
  return promise;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();

  mockRepo.findByIdInTenant.mockResolvedValue(campaign());
  mockRepo.getEvolutionKeyForCampaign.mockResolvedValue('inst-key');
  mockRepo.pendingContacts.mockResolvedValue(contacts(3));
  mockRepo.getStatus.mockResolvedValue('RUNNING');
  mockRepo.updateContactStatus.mockResolvedValue(undefined);
  mockRepo.incrementCounters.mockResolvedValue(undefined);
  mockRepo.recordOutboundMessage.mockResolvedValue(undefined);
  mockRepo.updateStatus.mockResolvedValue(1);
  mockSendText.mockResolvedValue({ key: { id: 'ext-1' } });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('campaignProcessor', () => {
  it('envia para todos os contatos, incrementa sent e emite progress + COMPLETED', async () => {
    const result = await runWithTimers();

    expect(mockSendText).toHaveBeenCalledTimes(3);
    expect(mockRepo.incrementCounters).toHaveBeenCalledWith(CAMPAIGN_ID, TENANT, { sent: 1 });
    // Cada SENT marca o CampaignContact.
    expect(mockRepo.updateContactStatus).toHaveBeenCalledWith('cc0', 'SENT', { externalId: 'ext-1' });
    // Marca COMPLETED ao fim.
    expect(mockRepo.updateStatus).toHaveBeenCalledWith(
      CAMPAIGN_ID,
      TENANT,
      'COMPLETED',
      expect.objectContaining({ completedAt: expect.any(Date) }),
    );
    // Emite progress por contato (3) + um final COMPLETED.
    const progressCalls = mockEmit.mock.calls.filter(c => c[1] === 'campaign:progress');
    expect(progressCalls.length).toBe(4);
    expect(progressCalls.at(-1)?.[2]).toMatchObject({ status: 'COMPLETED', sent: 3, failed: 0 });
    expect(result).toMatchObject({ sent: 3, failed: 0, total: 3, status: 'COMPLETED' });
  });

  it('uma falha de envio incrementa failedCount sem abortar a campanha', async () => {
    mockSendText
      .mockResolvedValueOnce({ key: { id: 'ext-0' } })
      .mockRejectedValueOnce(new Error('429 too many requests'))
      .mockResolvedValueOnce({ key: { id: 'ext-2' } });

    const result = await runWithTimers();

    expect(mockSendText).toHaveBeenCalledTimes(3);
    expect(mockRepo.incrementCounters).toHaveBeenCalledWith(CAMPAIGN_ID, TENANT, { failed: 1 });
    expect(mockRepo.updateContactStatus).toHaveBeenCalledWith(
      'cc1',
      'FAILED',
      expect.objectContaining({ errorMessage: expect.stringContaining('429') }),
    );
    expect(result).toMatchObject({ sent: 2, failed: 1, status: 'COMPLETED' });
  });

  it('interrompe graciosamente quando o status vira CANCELLED (sem COMPLETED)', async () => {
    // 1º check RUNNING, 2º check CANCELLED → para antes do 2º contato.
    mockRepo.getStatus
      .mockResolvedValueOnce('RUNNING')
      .mockResolvedValue('CANCELLED');

    const result = await runWithTimers();

    expect(mockSendText).toHaveBeenCalledTimes(1);
    expect(mockRepo.updateStatus).not.toHaveBeenCalledWith(
      CAMPAIGN_ID,
      TENANT,
      'COMPLETED',
      expect.anything(),
    );
    expect(result.status).toBe('CANCELLED');
  });

  it('interrompe quando o status vira PAUSED', async () => {
    mockRepo.getStatus.mockResolvedValueOnce('RUNNING').mockResolvedValue('PAUSED');

    const result = await runWithTimers();

    expect(result.status).toBe('PAUSED');
    expect(mockRepo.updateStatus).not.toHaveBeenCalledWith(
      CAMPAIGN_ID,
      TENANT,
      'COMPLETED',
      expect.anything(),
    );
  });

  it('marca FAILED se a instância não tiver evolutionKey', async () => {
    mockRepo.getEvolutionKeyForCampaign.mockResolvedValue(null);

    const result = await runWithTimers();

    expect(mockSendText).not.toHaveBeenCalled();
    expect(mockRepo.updateStatus).toHaveBeenCalledWith(
      CAMPAIGN_ID,
      TENANT,
      'FAILED',
      expect.objectContaining({ completedAt: expect.any(Date) }),
    );
    expect(result.status).toBe('FAILED');
  });

  it('envia mídia via sendMedia quando há mediaUrl (IMAGE)', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(
      campaign({
        messageType: 'IMAGE',
        messageContent: null,
        mediaUrl: 'https://cdn/x.jpg',
        mediaCaption: 'legenda',
      }),
    );
    mockRepo.pendingContacts.mockResolvedValue(contacts(1));
    mockSendMedia.mockResolvedValue({ key: { id: 'm-1' } });

    const result = await runWithTimers();

    expect(mockSendMedia).toHaveBeenCalledWith('inst-key', {
      number: '5527999000000',
      mediatype: 'image',
      media: 'https://cdn/x.jpg',
      caption: 'legenda',
    });
    expect(mockSendText).not.toHaveBeenCalled();
    expect(result).toMatchObject({ sent: 1, status: 'COMPLETED' });
  });

  it('mídia sem mediaUrl cai no fallback de texto (sendText)', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(
      campaign({ messageType: 'IMAGE', messageContent: null, mediaUrl: null, mediaCaption: 'cap' }),
    );
    mockRepo.pendingContacts.mockResolvedValue(contacts(1));

    await runWithTimers();

    expect(mockSendText).toHaveBeenCalledWith('inst-key', { number: '5527999000000', text: 'cap' });
    expect(mockSendMedia).not.toHaveBeenCalled();
  });

  it('mapeia VIDEO/AUDIO/DOCUMENT para o mediatype correto', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(
      campaign({ messageType: 'AUDIO', messageContent: null, mediaUrl: 'https://cdn/a.ogg' }),
    );
    mockRepo.pendingContacts.mockResolvedValue(contacts(1));
    mockSendMedia.mockResolvedValue({ key: { id: 'a-1' } });

    await runWithTimers();

    expect(mockSendMedia).toHaveBeenCalledWith(
      'inst-key',
      expect.objectContaining({ mediatype: 'audio' }),
    );
  });

  it('campanha sem contatos pendentes vai direto a COMPLETED', async () => {
    mockRepo.pendingContacts.mockResolvedValue([]);

    const result = await runWithTimers();

    expect(mockSendText).not.toHaveBeenCalled();
    expect(result).toMatchObject({ sent: 0, failed: 0, status: 'COMPLETED' });
  });

  it('campanha inexistente no tenant retorna NOT_FOUND', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(null);

    const result = await runWithTimers();

    expect(result.status).toBe('NOT_FOUND');
  });

  it('ignora campanha não-RUNNING', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(campaign({ status: 'DRAFT' }));

    const result = await runWithTimers();

    expect(mockSendText).not.toHaveBeenCalled();
    expect(result.status).toBe('DRAFT');
  });
});
