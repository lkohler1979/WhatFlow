import { AnalyticsQuerySchema, DEFAULT_PERIOD_DAYS } from '@modules/analytics/analytics.schema.js';

describe('analytics.schema — AnalyticsQuerySchema', () => {
  it('sem período aplica default: últimos 30 dias e granularity=day', () => {
    const before = Date.now();
    const r = AnalyticsQuerySchema.safeParse({});
    expect(r.success).toBe(true);
    if (!r.success) return;

    expect(r.data.granularity).toBe('day');
    // `to` ~ agora
    expect(r.data.to.getTime()).toBeGreaterThanOrEqual(before - 1000);
    // janela ~ 30 dias
    const spanDays = (r.data.to.getTime() - r.data.from.getTime()) / (24 * 60 * 60 * 1000);
    expect(Math.round(spanDays)).toBe(DEFAULT_PERIOD_DAYS);
  });

  it('aceita from/to em ISO date e granularity=week', () => {
    const r = AnalyticsQuerySchema.safeParse({
      from: '2026-06-01',
      to: '2026-06-15',
      granularity: 'week',
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.granularity).toBe('week');
    expect(r.data.from.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(r.data.to.toISOString()).toBe('2026-06-15T00:00:00.000Z');
  });

  it('quando só `to` é dado, `from` recua 30 dias a partir dele', () => {
    const r = AnalyticsQuerySchema.safeParse({ to: '2026-06-30' });
    expect(r.success).toBe(true);
    if (!r.success) return;
    const spanDays = (r.data.to.getTime() - r.data.from.getTime()) / (24 * 60 * 60 * 1000);
    expect(Math.round(spanDays)).toBe(DEFAULT_PERIOD_DAYS);
  });

  it('rejeita granularity inválida', () => {
    expect(AnalyticsQuerySchema.safeParse({ granularity: 'month' }).success).toBe(false);
  });

  it('rejeita from > to', () => {
    const r = AnalyticsQuerySchema.safeParse({ from: '2026-06-30', to: '2026-06-01' });
    expect(r.success).toBe(false);
  });

  it('rejeita período acima do limite (367 dias)', () => {
    const r = AnalyticsQuerySchema.safeParse({ from: '2025-01-01', to: '2026-06-30' });
    expect(r.success).toBe(false);
  });

  it('rejeita data inválida', () => {
    expect(AnalyticsQuerySchema.safeParse({ from: 'not-a-date' }).success).toBe(false);
  });
});
