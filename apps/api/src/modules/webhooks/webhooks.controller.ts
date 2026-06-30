import { Request, Response } from 'express';
import { webhooksService } from './webhooks.service.js';
import { ListDeliveriesQuerySchema } from './webhooks.schema.js';
import type { CreateWebhookDto, UpdateWebhookDto } from './webhooks.schema.js';

export const webhooksController = {
  async list(req: Request, res: Response): Promise<void> {
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 20);
    res.status(200).json(
      await webhooksService.list(req.tenantId as string, {
        page: Number.isFinite(page) && page > 0 ? page : 1,
        pageSize: Number.isFinite(pageSize) && pageSize > 0 ? Math.min(pageSize, 100) : 20,
      }),
    );
  },

  async create(req: Request, res: Response): Promise<void> {
    const webhook = await webhooksService.create(
      req.tenantId as string,
      req.body as CreateWebhookDto,
    );
    res.status(201).json(webhook);
  },

  async get(req: Request, res: Response): Promise<void> {
    res
      .status(200)
      .json(await webhooksService.get(req.tenantId as string, req.params.id as string));
  },

  async update(req: Request, res: Response): Promise<void> {
    const webhook = await webhooksService.update(
      req.tenantId as string,
      req.params.id as string,
      req.body as UpdateWebhookDto,
    );
    res.status(200).json(webhook);
  },

  async remove(req: Request, res: Response): Promise<void> {
    await webhooksService.remove(req.tenantId as string, req.params.id as string);
    res.status(204).send();
  },

  async deliveries(req: Request, res: Response): Promise<void> {
    const query = ListDeliveriesQuerySchema.parse(req.query);
    res
      .status(200)
      .json(
        await webhooksService.listDeliveries(
          req.tenantId as string,
          req.params.id as string,
          query,
        ),
      );
  },

  async test(req: Request, res: Response): Promise<void> {
    res
      .status(202)
      .json(await webhooksService.testWebhook(req.tenantId as string, req.params.id as string));
  },
};
