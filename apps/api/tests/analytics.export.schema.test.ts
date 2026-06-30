import { ExportQuerySchema } from '@modules/analytics/analytics-export.schema.js';

describe('ExportQuerySchema', () => {
  it('aceita report válido e normaliza o período (default csv + 30d)', () => {
    const r = ExportQuerySchema.parse({ report: 'messages' });
    expect(r.report).toBe('messages');
    expect(r.format).toBe('csv');
    expect(r.period.granularity).toBe('day');
    const spanDays =
      (r.period.to.getTime() - r.period.from.getTime()) / (24 * 60 * 60 * 1000);
    expect(Math.round(spanDays)).toBe(30);
  });

  it('propaga from/to/granularity para o período', () => {
    const r = ExportQuerySchema.parse({
      report: 'campaigns',
      from: '2026-06-01',
      to: '2026-06-30',
      granularity: 'week',
    });
    expect(r.report).toBe('campaigns');
    expect(r.period.from.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(r.period.granularity).toBe('week');
  });

  it('rejeita report desconhecido', () => {
    expect(() => ExportQuerySchema.parse({ report: 'foo' })).toThrow();
  });

  it('exige o parâmetro report', () => {
    expect(() => ExportQuerySchema.parse({})).toThrow();
  });

  it('propaga erro de período inválido (from > to)', () => {
    expect(() =>
      ExportQuerySchema.parse({ report: 'overview', from: '2026-06-30', to: '2026-06-01' }),
    ).toThrow();
  });
});
