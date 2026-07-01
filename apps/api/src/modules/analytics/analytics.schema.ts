import { z } from 'zod';

/** Janela padrão de análise quando o período não é informado (dias). */
export const DEFAULT_PERIOD_DAYS = 30;

/** Limite de segurança da janela para manter as queries rápidas (< 500ms). */
const MAX_PERIOD_DAYS = 366;

/**
 * Query de analytics: filtro de período (`from`/`to`, ISO date) e granularidade
 * para séries temporais. Tudo opcional — sem período => últimos 30 dias.
 *
 * `from`/`to` aceitam ISO date (`2026-06-01`) ou datetime ISO completo e são
 * coagidos para `Date`. A normalização (default, ordem, clamp) acontece no
 * `.transform`, então service/repository sempre recebem um range válido.
 */
export const AnalyticsQuerySchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    granularity: z.enum(['day', 'week']).default('day'),
  })
  .transform((q, ctx) => {
    const now = new Date();
    const to = q.to ?? now;
    const from = q.from ?? new Date(to.getTime() - DEFAULT_PERIOD_DAYS * 24 * 60 * 60 * 1000);

    if (from.getTime() > to.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '`from` deve ser anterior ou igual a `to`',
        path: ['from'],
      });
      return z.NEVER;
    }

    const spanDays = (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
    if (spanDays > MAX_PERIOD_DAYS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Período máximo de análise é ${MAX_PERIOD_DAYS} dias`,
        path: ['from'],
      });
      return z.NEVER;
    }

    return { from, to, granularity: q.granularity };
  });

export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>;

/** Período já normalizado, repassado às camadas internas. */
export interface AnalyticsPeriod {
  from: Date;
  to: Date;
  granularity: 'day' | 'week';
}
