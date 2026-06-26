import { Request, Response } from 'express';
import { flowsService } from './flows.service.js';
import type { CreateFlowDto, UpdateFlowDto } from './flows.schema.js';

export const flowsController = {
  async list(req: Request, res: Response): Promise<void> {
    res.status(200).json({ data: await flowsService.list(req.tenantId as string) });
  },
  async create(req: Request, res: Response): Promise<void> {
    const flow = await flowsService.create(req.tenantId as string, req.body as CreateFlowDto);
    res.status(201).json(flow);
  },
  async get(req: Request, res: Response): Promise<void> {
    res.status(200).json(await flowsService.get(req.tenantId as string, req.params.id as string));
  },
  async update(req: Request, res: Response): Promise<void> {
    const flow = await flowsService.update(
      req.tenantId as string,
      req.params.id as string,
      req.body as UpdateFlowDto,
    );
    res.status(200).json(flow);
  },
  async publish(req: Request, res: Response): Promise<void> {
    res
      .status(200)
      .json(await flowsService.publish(req.tenantId as string, req.params.id as string));
  },
  async duplicate(req: Request, res: Response): Promise<void> {
    res
      .status(201)
      .json(await flowsService.duplicate(req.tenantId as string, req.params.id as string));
  },
  async remove(req: Request, res: Response): Promise<void> {
    await flowsService.remove(req.tenantId as string, req.params.id as string);
    res.status(204).send();
  },
};
