import { Request, Response } from 'express';
import { conversationsService } from './conversations.service.js';
import { ListConversationsQuerySchema } from './conversations.schema.js';
import type { UpdateConversationDto } from './conversations.schema.js';

export const conversationsController = {
  async list(req: Request, res: Response): Promise<void> {
    const query = ListConversationsQuerySchema.parse(req.query);
    res.status(200).json(await conversationsService.list(req.tenantId as string, query));
  },
  async get(req: Request, res: Response): Promise<void> {
    res
      .status(200)
      .json(await conversationsService.get(req.tenantId as string, req.params.id as string));
  },
  async update(req: Request, res: Response): Promise<void> {
    const conv = await conversationsService.update(
      req.tenantId as string,
      req.params.id as string,
      req.body as UpdateConversationDto,
    );
    res.status(200).json(conv);
  },
  async markRead(req: Request, res: Response): Promise<void> {
    res
      .status(200)
      .json(await conversationsService.markRead(req.tenantId as string, req.params.id as string));
  },
};
