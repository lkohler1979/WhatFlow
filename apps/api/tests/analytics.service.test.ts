import { analyticsService } from '@modules/analytics/analytics.service.js';
import { analyticsRepository as repo } from '@modules/analytics/analytics.repository.js';
import type { AnalyticsPeriod } from '@modules/analytics/analytics.schema.js';

jest.mock('@modules/analytics/analytics.repository.js');

const mockRepo = repo as jest.Mocked<typeof repo>;

const period: AnalyticsPeriod = {
  from: new Date('2026-06-01T00:00:00.000Z'),
  to: new Date('2026-06-30T00:00:00.000Z'),
  granularity: 'day',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRepo.conversationCounts.mockResolvedValue({
    total: 5,
    byStatus: { OPEN: 3, PENDING: 1, RESOLVED: 1, SPAM: 0 },
  });
  mockRepo.messageTotals.mockResolvedValue({ total: 30, inbound: 18, outbound: 12 });
  mockRepo.contactsTotal.mockResolvedValue(42);
  mockRepo.instancesByStatus.mockResolvedValue({
    PENDING: 0,
    QR_PENDING: 1,
    CONNECTED: 2,
    DISCONNECTED: 0,
    BANNED: 0,
  });
  mockRepo.campaignCounts.mockResolvedValue({
    total: 4,
    byStatus: {
      DRAFT: 1,
      SCHEDULED: 0,
      RUNNING: 1,
      PAUSED: 0,
      COMPLETED: 2,
      CANCELLED: 0,
      FAILED: 0,
    },
    sent: 100,
    delivered: 90,
    failed: 10,
  });
});

describe('analyticsService.overview', () => {
  it('consolida KPIs e propaga o tenantId para todas as queries', async () => {
    const r = await analyticsService.overview('t1', period);

    expect(r.conversations.total).toBe(5);
    expect(r.conversations.byStatus.OPEN).toBe(3);
    expect(r.messages).toEqual({ total: 30, inbound: 18, outbound: 12 });
    expect(r.contacts.total).toBe(42);
    expect(r.instances.byStatus.CONNECTED).toBe(2);
    expect(r.campaigns.sent).toBe(100);
    expect(r.period.from).toBe('2026-06-01T00:00:00.000Z');

    // escopo por tenant em todas as agregações
    expect(mockRepo.conversationCounts).toHaveBeenCalledWith('t1', period);
    expect(mockRepo.messageTotals).toHaveBeenCalledWith('t1', period);
    expect(mockRepo.contactsTotal).toHaveBeenCalledWith('t1');
    expect(mockRepo.instancesByStatus).toHaveBeenCalledWith('t1');
    expect(mockRepo.campaignCounts).toHaveBeenCalledWith('t1', period);
  });
});

describe('analyticsService.messagesSeries', () => {
  it('agrupa linhas (bucket, direção) em pontos com inbound/outbound e ordena', async () => {
    const d1 = new Date('2026-06-01T00:00:00.000Z');
    const d2 = new Date('2026-06-02T00:00:00.000Z');
    mockRepo.messageSeriesRaw.mockResolvedValue([
      { bucket: d2, direction: 'OUTBOUND', count: 5n },
      { bucket: d1, direction: 'INBOUND', count: 7n },
      { bucket: d1, direction: 'OUTBOUND', count: 3n },
      { bucket: d2, direction: 'INBOUND', count: 2n },
    ]);

    const r = await analyticsService.messagesSeries('t1', period);

    expect(mockRepo.messageSeriesRaw).toHaveBeenCalledWith('t1', period);
    expect(r.granularity).toBe('day');
    expect(r.series).toEqual([
      { bucket: '2026-06-01T00:00:00.000Z', inbound: 7, outbound: 3 },
      { bucket: '2026-06-02T00:00:00.000Z', inbound: 2, outbound: 5 },
    ]);
  });

  it('série vazia → array vazio', async () => {
    mockRepo.messageSeriesRaw.mockResolvedValue([]);
    const r = await analyticsService.messagesSeries('t1', period);
    expect(r.series).toEqual([]);
  });

  it('converte bigint (COUNT) para number', async () => {
    mockRepo.messageSeriesRaw.mockResolvedValue([
      { bucket: new Date('2026-06-01T00:00:00.000Z'), direction: 'INBOUND', count: 1234567890n },
    ]);
    const r = await analyticsService.messagesSeries('t1', period);
    expect(r.series[0]?.inbound).toBe(1234567890);
    expect(typeof r.series[0]?.inbound).toBe('number');
  });
});

describe('analyticsService.campaignsSummary', () => {
  it('expõe contagem por status + somatórios de envio', async () => {
    const r = await analyticsService.campaignsSummary('t1', period);
    expect(r.campaigns.total).toBe(4);
    expect(r.campaigns.byStatus.COMPLETED).toBe(2);
    expect(r.campaigns).toMatchObject({ sent: 100, delivered: 90, failed: 10 });
    expect(mockRepo.campaignCounts).toHaveBeenCalledWith('t1', period);
  });
});
