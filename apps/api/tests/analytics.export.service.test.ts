import {
  analyticsExportService,
  UTF8_BOM,
} from '@modules/analytics/analytics-export.service.js';
import { analyticsService } from '@modules/analytics/analytics.service.js';
import type { AnalyticsPeriod } from '@modules/analytics/analytics.schema.js';

jest.mock('@modules/analytics/analytics.service.js');

const mockService = analyticsService as jest.Mocked<typeof analyticsService>;

const period: AnalyticsPeriod = {
  from: new Date('2026-06-01T00:00:00.000Z'),
  to: new Date('2026-06-30T00:00:00.000Z'),
  granularity: 'day',
};

const periodDto = {
  from: period.from.toISOString(),
  to: period.to.toISOString(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

/** Linhas do CSV sem o BOM, separadas por CRLF. */
function lines(csv: string): string[] {
  return csv.replace(/^﻿/, '').split('\r\n');
}

describe('analyticsExportService — messages', () => {
  it('gera cabeçalho + série temporal com total e reusa o analyticsService', async () => {
    mockService.messagesSeries.mockResolvedValue({
      period: periodDto,
      granularity: 'day',
      series: [
        { bucket: '2026-06-01T00:00:00.000Z', inbound: 7, outbound: 3 },
        { bucket: '2026-06-02T00:00:00.000Z', inbound: 2, outbound: 5 },
      ],
    });

    const r = await analyticsExportService.export('t1', 'messages', period);

    expect(mockService.messagesSeries).toHaveBeenCalledWith('t1', period);
    const rows = lines(r.csv);
    expect(rows[0]).toBe('bucket,recebidas,enviadas,total');
    expect(rows[1]).toBe('2026-06-01T00:00:00.000Z,7,3,10');
    expect(rows[2]).toBe('2026-06-02T00:00:00.000Z,2,5,7');
    expect(r.filename).toBe('relatorio-messages-20260601-20260630.csv');
  });

  it('série vazia → apenas cabeçalho', async () => {
    mockService.messagesSeries.mockResolvedValue({
      period: periodDto,
      granularity: 'day',
      series: [],
    });
    const r = await analyticsExportService.export('t1', 'messages', period);
    expect(lines(r.csv)).toEqual(['bucket,recebidas,enviadas,total']);
  });
});

describe('analyticsExportService — campaigns', () => {
  it('gera linhas chave/valor por status + somatórios', async () => {
    mockService.campaignsSummary.mockResolvedValue({
      period: periodDto,
      campaigns: {
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
      },
    });

    const r = await analyticsExportService.export('t1', 'campaigns', period);

    expect(mockService.campaignsSummary).toHaveBeenCalledWith('t1', period);
    const rows = lines(r.csv);
    expect(rows[0]).toBe('metrica,valor');
    expect(rows).toContain('total,4');
    expect(rows).toContain('status_COMPLETED,2');
    expect(rows).toContain('mensagens_enviadas,100');
    expect(rows).toContain('mensagens_entregues,90');
    expect(rows).toContain('mensagens_falhas,10');
  });
});

describe('analyticsExportService — overview', () => {
  it('gera KPIs consolidados em chave/valor', async () => {
    mockService.overview.mockResolvedValue({
      period: periodDto,
      conversations: { total: 5, byStatus: { OPEN: 3, PENDING: 1, RESOLVED: 1, SPAM: 0 } },
      messages: { total: 30, inbound: 18, outbound: 12 },
      contacts: { total: 42 },
      instances: {
        byStatus: { PENDING: 0, QR_PENDING: 1, CONNECTED: 2, DISCONNECTED: 0, BANNED: 0 },
      },
      campaigns: {
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
      },
    });

    const r = await analyticsExportService.export('t1', 'overview', period);

    expect(mockService.overview).toHaveBeenCalledWith('t1', period);
    const rows = lines(r.csv);
    expect(rows[0]).toBe('metrica,valor');
    expect(rows).toContain('conversas_total,5');
    expect(rows).toContain('mensagens_total,30');
    expect(rows).toContain('contatos_total,42');
    expect(rows).toContain('instancias_CONNECTED,2');
    expect(rows).toContain('campanhas_enviadas,100');
  });
});

describe('analyticsExportService — formato do arquivo', () => {
  beforeEach(() => {
    mockService.messagesSeries.mockResolvedValue({
      period: periodDto,
      granularity: 'day',
      series: [{ bucket: '2026-06-01T00:00:00.000Z', inbound: 1, outbound: 0 }],
    });
  });

  it('prefixa o conteúdo com BOM UTF-8 (Excel abre sem erros)', async () => {
    const r = await analyticsExportService.export('t1', 'messages', period);
    expect(r.csv.startsWith(UTF8_BOM)).toBe(true);
    expect(r.csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('usa CRLF entre as linhas', async () => {
    const r = await analyticsExportService.export('t1', 'messages', period);
    expect(r.csv).toContain('\r\n');
  });
});

describe('analyticsExportService — escaping CSV', () => {
  it('envolve em aspas e duplica aspas internas em campos com vírgula/aspas/quebra', async () => {
    // overview com um "status" que contém vírgula e aspas para exercitar o escape.
    mockService.overview.mockResolvedValue({
      period: periodDto,
      conversations: {
        total: 1,
        byStatus: { 'A,B': 1, 'C"D': 2, 'E\nF': 3 } as never,
      },
      messages: { total: 0, inbound: 0, outbound: 0 },
      contacts: { total: 0 },
      instances: {
        byStatus: { PENDING: 0, QR_PENDING: 0, CONNECTED: 0, DISCONNECTED: 0, BANNED: 0 },
      },
      campaigns: {
        total: 0,
        byStatus: {
          DRAFT: 0,
          SCHEDULED: 0,
          RUNNING: 0,
          PAUSED: 0,
          COMPLETED: 0,
          CANCELLED: 0,
          FAILED: 0,
        },
        sent: 0,
        delivered: 0,
        failed: 0,
      },
    });

    const r = await analyticsExportService.export('t1', 'overview', period);
    // chave com vírgula → todo o campo entre aspas
    expect(r.csv).toContain('"conversas_A,B",1');
    // aspas internas duplicadas
    expect(r.csv).toContain('"conversas_C""D",2');
    // quebra de linha dentro do campo → entre aspas
    expect(r.csv).toContain('"conversas_E\nF",3');
  });
});
