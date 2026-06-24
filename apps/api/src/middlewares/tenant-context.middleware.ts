import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '@core/errors.js';

/** Garante que req.tenantId está definido antes de processar a request */
export function requireTenant(req: Request, _res: Response, next: NextFunction) {
  if (!req.tenantId) throw new UnauthorizedError('Tenant não identificado no token');
  next();
}
