import { Request, Response } from 'express';
import { aiConfigService } from './ai.service.js';
import type { UpsertAiConfigDto, TestAiConfigDto } from './ai.schema.js';

export const aiController = {
  async getConfig(req: Request, res: Response): Promise<void> {
    res.status(200).json(await aiConfigService.getConfig(req.tenantId as string));
  },

  async upsertConfig(req: Request, res: Response): Promise<void> {
    const view = await aiConfigService.upsertConfig(
      req.tenantId as string,
      req.body as UpsertAiConfigDto,
    );
    res.status(200).json(view);
  },

  async test(req: Request, res: Response): Promise<void> {
    const result = await aiConfigService.test(req.tenantId as string, req.body as TestAiConfigDto);
    res.status(200).json(result);
  },
};
