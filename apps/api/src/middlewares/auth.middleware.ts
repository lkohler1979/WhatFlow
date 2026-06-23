import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '@core/config.js';
import { UnauthorizedError } from '@core/errors.js';

export interface JwtPayload {
  sub: string; // supabase user id
  app_metadata: {
    tenant_id: string;
    role: string;
  };
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      tenantId?: string;
      userRole?: string;
    }
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new UnauthorizedError('Token não fornecido');

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, config.SUPABASE_JWT_SECRET) as JwtPayload;
    req.user = payload;
    req.tenantId = payload.app_metadata?.tenant_id;
    req.userRole = payload.app_metadata?.role;
    next();
  } catch {
    throw new UnauthorizedError('Token inválido ou expirado');
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      throw new UnauthorizedError('Permissão insuficiente');
    }
    next();
  };
}
