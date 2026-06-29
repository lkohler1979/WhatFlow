import { Request, Response } from 'express';
import { campaignsService } from './campaigns.service.js';
import { ListCampaignsQuerySchema } from './campaigns.schema.js';
import type { CreateCampaignDto, UpdateCampaignDto } from './campaigns.schema.js';

export const campaignsController = {
  async list(req: Request, res: Response): Promise<void> {
    const query = ListCampaignsQuerySchema.parse(req.query);
    res.status(200).json(await campaignsService.list(req.tenantId as string, query));
  },
  async create(req: Request, res: Response): Promise<void> {
    const campaign = await campaignsService.create(
      req.tenantId as string,
      req.body as CreateCampaignDto,
    );
    res.status(201).json(campaign);
  },
  async get(req: Request, res: Response): Promise<void> {
    res
      .status(200)
      .json(await campaignsService.get(req.tenantId as string, req.params.id as string));
  },
  async update(req: Request, res: Response): Promise<void> {
    const campaign = await campaignsService.update(
      req.tenantId as string,
      req.params.id as string,
      req.body as UpdateCampaignDto,
    );
    res.status(200).json(campaign);
  },
  async start(req: Request, res: Response): Promise<void> {
    res
      .status(200)
      .json(await campaignsService.start(req.tenantId as string, req.params.id as string));
  },
  async pause(req: Request, res: Response): Promise<void> {
    res
      .status(200)
      .json(await campaignsService.pause(req.tenantId as string, req.params.id as string));
  },
  async cancel(req: Request, res: Response): Promise<void> {
    res
      .status(200)
      .json(await campaignsService.cancel(req.tenantId as string, req.params.id as string));
  },
  async remove(req: Request, res: Response): Promise<void> {
    await campaignsService.remove(req.tenantId as string, req.params.id as string);
    res.status(204).send();
  },
};
