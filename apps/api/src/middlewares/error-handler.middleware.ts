import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '@core/errors.js';
import { logger } from '@core/logger.js';

export function errorHandlerMiddleware(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.code, message: err.message });
    return;
  }

  if (err instanceof ZodError) {
    res.status(422).json({
      error: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      details: err.flatten().fieldErrors,
    });
    return;
  }

  logger.error({ err, url: req.url, method: req.method }, 'Erro não tratado');
  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erro interno do servidor' });
}
