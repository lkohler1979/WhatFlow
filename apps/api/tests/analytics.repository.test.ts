import { analyticsRepository } from '@modules/analytics/analytics.repository.js';
import { prisma } from '@core/prisma.js';
import type { AnalyticsPeriod } from '@modules/analytics/analytics.schema.js';

jest.mock('@core/prisma.js', () => ({
  __esModule: true,
  prisma: {
    conversation: { count: jest.fn(), groupBy: jest.fn() },
    message: { groupBy: jest.fn() },
    contact: { count: jest.fn() },
    instance: { groupBy: jest.fn() },
    campaign: { count: jest.fn(), groupBy: jest.fn(), aggregate: jest.fn() },
    $queryRaw: jest.fn(),
  },
}));

// `Prisma` (namespace) é re-exportado do client real; mockamos só o `prisma`.
const p = prisma as unknown as {
  conversation: { count: jest.Mock; groupBy: jest.Mock };
  message: { groupBy: jest.Mock };
  contact: { count: jest.Mock };
  instance: { groupBy: jest.Mock };
  campaign: { count: jest.Mock; groupBy: jest.Mock; aggregate: jest.Mock };
  $queryRaw: jest.Mock;
};

const period: AnalyticsPeriod = {
  from: new Date('2026-06-01T00:00:00.000Z'),
  to: new Date('2026-06-30T00:00:00.000Z'),
  granularity: 'day',
};

beforeEach(() => jest.clearAllMocks());

describe('analyticsRepository.conversationCounts', () => {
  it('escopa por tenant+período e preenche todos os status (zeros nos ausentes)', async () => {
    p.conversation.count.mockResolvedValue(4);
    p.conversation.groupBy.mockResolvedValue([
      { status: 'OPEN', _count: { _all: 3 } },
      { status: 'RESOLVED', _count: { _all: 1 } },
    ]);

    const r = await analyticsRepository.conversationCounts('t1', period);

    expect(r.total).toBe(4);
    expect(r.byStatus).toEqual({ OPEN: 3, PENDING: 0, RESOLVED: 1, SPAM: 0 });

    const where = p.conversation.count.mock.calls[0][0].where;
    expect(where.tenantId).toBe('t1');
    expect(where.createdAt).toEqual({ gte: period.from, lte: period.to });
  });
});

describe('analyticsRepository.messageTotals', () => {
  it('separa INBOUND/OUTBOUND e escopa pela conversa do tenant + timestamp', async () => {
    p.message.groupBy.mockResolvedValue([
      { direction: 'INBOUND', _count: { _all: 18 } },
      { direction: 'OUTBOUND', _count: { _all: 12 } },
    ]);

    const r = await analyticsRepository.messageTotals('t1', period);

    expect(r).toEqual({ total: 30, inbound: 18, outbound: 12 });
    const where = p.message.groupBy.mock.calls[0][0].where;
    expect(where.conversation).toEqual({ tenantId: 't1' });
    expect(where.timestamp).toEqual({ gte: period.from, lte: period.to });
  });

  it('sem mensagens → tudo zero', async () => {
    p.message.groupBy.mockResolvedValue([]);
    const r = await analyticsRepository.messageTotals('t1', period);
    expect(r).toEqual({ total: 0, inbound: 0, outbound: 0 });
  });
});

describe('analyticsRepository.contactsTotal / instancesByStatus', () => {
  it('contatos: count escopado por tenant', async () => {
    p.contact.count.mockResolvedValue(42);
    const r = await analyticsRepository.contactsTotal('t1');
    expect(r).toBe(42);
    expect(p.contact.count.mock.calls[0][0].where).toEqual({ tenantId: 't1' });
  });

  it('instâncias: todos os status presentes, escopo por tenant', async () => {
    p.instance.groupBy.mockResolvedValue([{ status: 'CONNECTED', _count: { _all: 2 } }]);
    const r = await analyticsRepository.instancesByStatus('t1');
    expect(r).toEqual({
      PENDING: 0,
      QR_PENDING: 0,
      CONNECTED: 2,
      DISCONNECTED: 0,
      BANNED: 0,
    });
    expect(p.instance.groupBy.mock.calls[0][0].where).toEqual({ tenantId: 't1' });
  });
});

describe('analyticsRepository.campaignCounts', () => {
  it('agrega por status + soma sent/delivered/failed (escopo tenant+período)', async () => {
    p.campaign.count.mockResolvedValue(3);
    p.campaign.groupBy.mockResolvedValue([
      { status: 'COMPLETED', _count: { _all: 2 } },
      { status: 'RUNNING', _count: { _all: 1 } },
    ]);
    p.campaign.aggregate.mockResolvedValue({
      _sum: { sentCount: 100, deliveredCount: 90, failedCount: 10 },
    });

    const r = await analyticsRepository.campaignCounts('t1', period);

    expect(r.total).toBe(3);
    expect(r.byStatus.COMPLETED).toBe(2);
    expect(r.byStatus.DRAFT).toBe(0);
    expect(r).toMatchObject({ sent: 100, delivered: 90, failed: 10 });
    expect(p.campaign.count.mock.calls[0][0].where.tenantId).toBe('t1');
  });

  it('somatórios nulos (sem campanhas) → 0', async () => {
    p.campaign.count.mockResolvedValue(0);
    p.campaign.groupBy.mockResolvedValue([]);
    p.campaign.aggregate.mockResolvedValue({
      _sum: { sentCount: null, deliveredCount: null, failedCount: null },
    });
    const r = await analyticsRepository.campaignCounts('t1', period);
    expect(r).toMatchObject({ total: 0, sent: 0, delivered: 0, failed: 0 });
  });
});

describe('analyticsRepository.messageSeriesRaw', () => {
  it('usa $queryRaw parametrizado (tenant + range) e devolve as linhas', async () => {
    const rows = [{ bucket: period.from, direction: 'INBOUND', count: 5n }];
    p.$queryRaw.mockResolvedValue(rows);

    const r = await analyticsRepository.messageSeriesRaw('t1', period);

    expect(r).toBe(rows);
    expect(p.$queryRaw).toHaveBeenCalledTimes(1);
    // Tagged template: 1º arg é o array de strings; valores parametrizados seguem.
    const callArgs = p.$queryRaw.mock.calls[0];
    expect(callArgs).toContain('t1');
    expect(callArgs).toContain(period.from);
    expect(callArgs).toContain(period.to);
  });
});
