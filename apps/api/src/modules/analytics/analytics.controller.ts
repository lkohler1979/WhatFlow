import { Request, Response } from 'express';
import { analyticsService } from './analytics.service.js';
import { analyticsExportService } from './analytics-export.service.js';
import { AnalyticsQuerySchema } from './analytics.schema.js';
import { ExportQuerySchema } from './analytics-export.schema.js';

export const analyticsController = {
  async overview(req: Request, res: Response): Promise<void> {
    const period = AnalyticsQuerySchema.parse(req.query);
    res.status(200).json(await analyticsService.overview(req.tenantId as string, period));
  },

  async messages(req: Request, res: Response): Promise<void> {
    const period = AnalyticsQuerySchema.parse(req.query);
    res.status(200).json(await analyticsService.messagesSeries(req.tenantId as string, period));
  },

  async campaigns(req: Request, res: Response): Promise<void> {
    const period = AnalyticsQuerySchema.parse(req.query);
    res.status(200).json(await analyticsService.campaignsSummary(req.tenantId as string, period));
  },

  /** Export CSV (UTF-8 com BOM) de um relatório do período — abre no Excel sem erros. */
  async export(req: Request, res: Response): Promise<void> {
    const { report, period } = ExportQuerySchema.parse(req.query);
    const result = await analyticsExportService.export(req.tenantId as string, report, period);
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.status(200).send(result.csv);
  },
};
