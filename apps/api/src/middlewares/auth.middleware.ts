import { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { config } from '@core/config.js';
import { ForbiddenError, UnauthorizedError } from '@core/errors.js';

export interface JwtPayload extends JWTPayload {
  sub: string; // supabase user id
  app_metadata?: {
    tenant_id?: string;
    role?: string;
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

// Projetos Supabase atuais assinam o JWT com chaves assimétricas (ES256).
// A verificação usa a chave pública do projeto via JWKS (cacheado pela jose),
// e não um segredo HMAC. O endpoint expõe a(s) chave(s) por `kid`.
const ISSUER = `${config.SUPABASE_URL.replace(/\/+$/, '')}/auth/v1`;
const jwks = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks.json`));

export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Token não fornecido'));
  }

  const token = header.slice(7);
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: ISSUER,
      audience: 'authenticated',
    });
    const claims = payload as JwtPayload;
    req.user = claims;
    req.tenantId = claims.app_metadata?.tenant_id;
    req.userRole = claims.app_metadata?.role;
    next();
  } catch {
    next(new UnauthorizedError('Token inválido ou expirado'));
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      return next(new ForbiddenError('Permissão insuficiente'));
    }
    next();
  };
}
