import { Request, Response } from 'express';
import { analyticsService } from './analytics.service.js';
import { AnalyticsQuerySchema } from './analytics.schema.js';

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
};
