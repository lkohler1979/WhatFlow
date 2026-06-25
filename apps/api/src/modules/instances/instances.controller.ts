import { Request, Response } from 'express';
import { instancesService } from './instances.service.js';
import type { CreateInstanceDto, SendMessageDto } from './instances.schema.js';

export const instancesController = {
  async list(req: Request, res: Response): Promise<void> {
    const data = await instancesService.list(req.tenantId as string);
    res.status(200).json({ data });
  },

  async create(req: Request, res: Response): Promise<void> {
    const inst = await instancesService.create(
      req.tenantId as string,
      req.body as CreateInstanceDto,
    );
    res.status(201).json(inst);
  },

  async get(req: Request, res: Response): Promise<void> {
    const inst = await instancesService.get(req.tenantId as string, req.params.id as string);
    res.status(200).json(inst);
  },

  async qrCode(req: Request, res: Response): Promise<void> {
    const qr = await instancesService.getQrCode(req.tenantId as string, req.params.id as string);
    res.status(200).json(qr);
  },

  async remove(req: Request, res: Response): Promise<void> {
    await instancesService.remove(req.tenantId as string, req.params.id as string);
    res.status(204).send();
  },

  async send(req: Request, res: Response): Promise<void> {
    const result = await instancesService.sendMessage(
      req.tenantId as string,
      req.params.id as string,
      req.body as SendMessageDto,
    );
    res.status(201).json(result);
  },
};
