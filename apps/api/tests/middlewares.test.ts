import type { Request, Response, NextFunction } from 'express';
// `jose` é ESM-only e quebra o transform do ts-jest ao ser importado
// transitivamente por auth.middleware. Como aqui só exercitamos `requireRole`
// (que não usa jose), mockamos o módulo com stubs.
jest.mock('jose', () => ({
  __esModule: true,
  createRemoteJWKSet: () => () => undefined,
  jwtVerify: jest.fn(),
}));
import { requireRole } from '@middlewares/auth.middleware.js';
import { errorHandlerMiddleware } from '@middlewares/error-handler.middleware.js';
import { validate } from '@middlewares/validate.middleware.js';
import { requireTenant } from '@middlewares/tenant-context.middleware.js';
import { requestIdMiddleware } from '@middlewares/request-id.middleware.js';
import { AppError, ForbiddenError } from '@core/errors.js';
import { z, ZodError } from 'zod';

function mockRes() {
  const res: Partial<Response> & { body?: unknown; statusCode?: number } = {};
  res.status = jest.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res as Response;
  });
  res.json = jest.fn().mockImplementation((b: unknown) => {
    res.body = b;
    return res as Response;
  });
  res.setHeader = jest.fn();
  return res as Response & { body?: unknown; statusCode?: number };
}

describe('requireRole', () => {
  it('permite quando o papel está na lista', () => {
    const next = jest.fn() as unknown as NextFunction;
    const req = { userRole: 'OWNER' } as Request;
    requireRole('OWNER', 'ADMIN')(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('bloqueia (403) quando o papel não está na lista', () => {
    const next = jest.fn() as unknown as NextFunction;
    const req = { userRole: 'AGENT' } as Request;
    requireRole('OWNER')(req, mockRes(), next);
    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err).toBeInstanceOf(ForbiddenError);
  });

  it('bloqueia quando não há papel', () => {
    const next = jest.fn() as unknown as NextFunction;
    requireRole('OWNER')({} as Request, mockRes(), next);
    expect((next as jest.Mock).mock.calls[0][0]).toBeInstanceOf(ForbiddenError);
  });
});

describe('errorHandlerMiddleware', () => {
  it('AppError → statusCode + code/message', () => {
    const res = mockRes();
    errorHandlerMiddleware(
      new AppError('boom', 409, 'CONFLICT'),
      {} as Request,
      res,
      jest.fn() as unknown as NextFunction,
    );
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error: 'CONFLICT', message: 'boom' });
  });

  it('ZodError → 422 VALIDATION_ERROR com details', () => {
    const res = mockRes();
    let zodErr: ZodError;
    try {
      z.object({ a: z.string() }).parse({});
      throw new Error('unreachable');
    } catch (e) {
      zodErr = e as ZodError;
    }
    errorHandlerMiddleware(zodErr!, {} as Request, res, jest.fn() as unknown as NextFunction);
    expect(res.statusCode).toBe(422);
    expect((res.body as { error: string }).error).toBe('VALIDATION_ERROR');
  });

  it('erro genérico → 500 INTERNAL_ERROR', () => {
    const res = mockRes();
    errorHandlerMiddleware(
      new Error('unexpected'),
      { url: '/x', method: 'GET' } as Request,
      res,
      jest.fn() as unknown as NextFunction,
    );
    expect(res.statusCode).toBe(500);
    expect((res.body as { error: string }).error).toBe('INTERNAL_ERROR');
  });
});

describe('validate middleware', () => {
  const schema = z.object({ name: z.string() });

  it('substitui req[target] pelos dados parseados e chama next()', () => {
    const next = jest.fn() as unknown as NextFunction;
    const req = { body: { name: 'ok', extra: 1 } } as unknown as Request;
    validate(schema)(req, mockRes(), next);
    expect(req.body).toEqual({ name: 'ok' });
    expect(next).toHaveBeenCalledWith();
  });

  it('encaminha o ZodError ao next em caso de falha', () => {
    const next = jest.fn() as unknown as NextFunction;
    const req = { body: {} } as unknown as Request;
    validate(schema)(req, mockRes(), next);
    expect((next as jest.Mock).mock.calls[0][0]).toBeInstanceOf(ZodError);
  });

  it('valida o target informado (query)', () => {
    const next = jest.fn() as unknown as NextFunction;
    const req = { query: { name: 'q' } } as unknown as Request;
    validate(schema, 'query')(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith();
  });
});

describe('requireTenant', () => {
  it('passa quando há tenantId', () => {
    const next = jest.fn() as unknown as NextFunction;
    requireTenant({ tenantId: 't1' } as Request, mockRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('lança UnauthorizedError sem tenantId', () => {
    expect(() =>
      requireTenant({} as Request, mockRes(), jest.fn() as unknown as NextFunction),
    ).toThrow();
  });
});

describe('requestIdMiddleware', () => {
  it('reusa o header x-request-id existente', () => {
    const next = jest.fn() as unknown as NextFunction;
    const res = mockRes();
    const req = { headers: { 'x-request-id': 'abc' } } as unknown as Request;
    requestIdMiddleware(req, res, next);
    expect(req.headers['x-request-id']).toBe('abc');
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'abc');
    expect(next).toHaveBeenCalledWith();
  });

  it('gera um id quando não existe header', () => {
    const next = jest.fn() as unknown as NextFunction;
    const res = mockRes();
    const req = { headers: {} } as unknown as Request;
    requestIdMiddleware(req, res, next);
    expect(typeof req.headers['x-request-id']).toBe('string');
    expect((req.headers['x-request-id'] as string).length).toBeGreaterThan(0);
  });
});
