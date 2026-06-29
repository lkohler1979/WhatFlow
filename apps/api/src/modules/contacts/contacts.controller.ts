import { Request, Response } from 'express';
import { contactsService } from './contacts.service.js';
import { ListContactsQuerySchema } from './contacts.schema.js';
import type { CreateContactDto, ImportContactsDto, UpdateContactDto } from './contacts.schema.js';

export const contactsController = {
  async list(req: Request, res: Response): Promise<void> {
    const query = ListContactsQuerySchema.parse(req.query);
    res.status(200).json(await contactsService.list(req.tenantId as string, query));
  },

  async create(req: Request, res: Response): Promise<void> {
    const contact = await contactsService.create(
      req.tenantId as string,
      req.body as CreateContactDto,
    );
    res.status(201).json(contact);
  },

  async get(req: Request, res: Response): Promise<void> {
    res
      .status(200)
      .json(await contactsService.get(req.tenantId as string, req.params.id as string));
  },

  async update(req: Request, res: Response): Promise<void> {
    const contact = await contactsService.update(
      req.tenantId as string,
      req.params.id as string,
      req.body as UpdateContactDto,
    );
    res.status(200).json(contact);
  },

  async remove(req: Request, res: Response): Promise<void> {
    await contactsService.remove(req.tenantId as string, req.params.id as string);
    res.status(204).send();
  },

  async importCsv(req: Request, res: Response): Promise<void> {
    const result = await contactsService.importCsv(
      req.tenantId as string,
      req.body as ImportContactsDto,
    );
    res.status(200).json(result);
  },

  async exportCsv(req: Request, res: Response): Promise<void> {
    const query = ListContactsQuerySchema.parse(req.query);
    const csv = await contactsService.export(req.tenantId as string, query);
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header('Content-Disposition', 'attachment; filename="contacts.csv"');
    res.status(200).send(csv);
  },
};
