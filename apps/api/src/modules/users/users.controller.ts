import { Request, Response } from 'express';
import { usersService } from './users.service.js';
import type { InviteUserDto, UpdateRoleDto } from './users.schema.js';

export const usersController = {
  async list(req: Request, res: Response): Promise<void> {
    const users = await usersService.list(req.tenantId as string);
    res.status(200).json({ data: users });
  },

  async invite(req: Request, res: Response): Promise<void> {
    const user = await usersService.invite(req.tenantId as string, req.body as InviteUserDto);
    res.status(201).json(user);
  },

  async updateRole(req: Request, res: Response): Promise<void> {
    const user = await usersService.updateRole(
      req.tenantId as string,
      req.params.id as string,
      req.body as UpdateRoleDto,
    );
    res.status(200).json(user);
  },

  async remove(req: Request, res: Response): Promise<void> {
    await usersService.remove(
      req.tenantId as string,
      req.params.id as string,
      req.user?.sub as string,
    );
    res.status(204).send();
  },
};
