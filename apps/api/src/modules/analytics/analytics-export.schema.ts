import { z } from 'zod';
import { AnalyticsQuerySchema } from './analytics.schema.js';

/** Relatórios disponíveis para export. */
export const EXPORT_REPORTS = ['messages', 'campaigns', 'overview'] as const;
export type ExportReport = (typeof EXPORT_REPORTS)[number];

/**
 * Query do export: `report` (qual relatório) + filtro de período/granularidade
 * reaproveitado do analytics (T-044). `format` é opcional e hoje só aceita `csv`.
 *
 * Validamos `report`/`format` à parte e reutilizamos o `AnalyticsQuerySchema`
 * para normalizar o período (default 30d, ordem, clamp).
 */
export const ExportQuerySchema = z
  .object({
    report: z.enum(EXPORT_REPORTS),
    format: z.literal('csv').default('csv'),
  })
  .passthrough()
  .transform((q, ctx) => {
    const period = AnalyticsQuerySchema.safeParse(q);
    if (!period.success) {
      for (const issue of period.error.issues) ctx.addIssue(issue);
      return z.NEVER;
    }
    return { report: q.report, format: q.format, period: period.data };
  });

export type ExportQuery = z.infer<typeof ExportQuerySchema>;
