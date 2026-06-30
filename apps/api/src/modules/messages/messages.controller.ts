import { Request, Response } from 'express';
import { messagesService } from './messages.service.js';
import { ListMessagesQuerySchema } from './messages.schema.js';
import type { CreateNoteDto, SendMessageDto } from './messages.schema.js';

export const messagesController = {
  async list(req: Request, res: Response): Promise<void> {
    const query = ListMessagesQuerySchema.parse(req.query);
    res
      .status(200)
      .json(await messagesService.list(req.tenantId as string, req.params.id as string, query));
  },
  async send(req: Request, res: Response): Promise<void> {
    const message = await messagesService.send(
      req.tenantId as string,
      req.params.id as string,
      req.body as SendMessageDto,
      req.user?.sub,
    );
    res.status(201).json(message);
  },
  async addNote(req: Request, res: Response): Promise<void> {
    const note = await messagesService.addNote(
      req.tenantId as string,
      req.params.id as string,
      req.body as CreateNoteDto,
      req.user?.sub,
    );
    res.status(201).json(note);
  },
};
