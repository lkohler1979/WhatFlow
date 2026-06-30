import { Request, Response } from 'express';
import { tagsService } from './tags.service.js';
import { ListTagsQuerySchema } from './tags.schema.js';
import type { CreateTagDto, UpdateTagDto } from './tags.schema.js';

export const tagsController = {
  async list(req: Request, res: Response): Promise<void> {
    const { q } = ListTagsQuerySchema.parse(req.query);
    res.status(200).json(await tagsService.list(req.tenantId as string, q));
  },

  async create(req: Request, res: Response): Promise<void> {
    const tag = await tagsService.create(req.tenantId as string, req.body as CreateTagDto);
    res.status(201).json(tag);
  },

  async update(req: Request, res: Response): Promise<void> {
    const tag = await tagsService.update(
      req.tenantId as string,
      req.params.id as string,
      req.body as UpdateTagDto,
    );
    res.status(200).json(tag);
  },

  async remove(req: Request, res: Response): Promise<void> {
    await tagsService.remove(req.tenantId as string, req.params.id as string);
    res.status(204).send();
  },

  // ── Aplicação a contatos (montadas nas rotas de contacts) ──

  async attachToContact(req: Request, res: Response): Promise<void> {
    const { tagId } = req.body as { tagId: string };
    await tagsService.attachToContact(req.tenantId as string, req.params.id as string, tagId);
    res.status(204).send();
  },

  async detachFromContact(req: Request, res: Response): Promise<void> {
    await tagsService.detachFromContact(
      req.tenantId as string,
      req.params.id as string,
      req.params.tagId as string,
    );
    res.status(204).send();
  },
};
