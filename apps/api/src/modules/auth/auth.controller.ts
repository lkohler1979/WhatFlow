import { Request, Response } from 'express';
import { authService } from './auth.service.js';
import type { LoginDto, RegisterDto, RefreshDto } from './auth.schema.js';

/**
 * Controllers: recebem a request (já validada pelo middleware),
 * delegam ao service e devolvem a response. Sem lógica de negócio.
 * Express 5 propaga rejections de handlers async ao errorHandler.
 */
export const authController = {
  async register(req: Request, res: Response): Promise<void> {
    const result = await authService.register(req.body as RegisterDto);
    res.status(201).json(result);
  },

  async login(req: Request, res: Response): Promise<void> {
    const result = await authService.login(req.body as LoginDto);
    res.status(200).json(result);
  },

  async refresh(req: Request, res: Response): Promise<void> {
    const session = await authService.refresh(req.body as RefreshDto);
    res.status(200).json({ session });
  },

  async logout(req: Request, res: Response): Promise<void> {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    await authService.logout(token);
    res.status(204).send();
  },

  async me(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      id: req.user?.sub,
      tenantId: req.tenantId,
      role: req.userRole,
    });
  },
};
