import { Router } from 'express';
import { tagsController } from './tags.controller.js';
import { validate } from '@middlewares/validate.middleware.js';
import { authMiddleware, requireRole } from '@middlewares/auth.middleware.js';
import { requireTenant } from '@middlewares/tenant-context.middleware.js';
import { CreateTagSchema, TagIdParamSchema, UpdateTagSchema } from './tags.schema.js';

export const tagsRoutes: Router = Router();

tagsRoutes.use(authMiddleware, requireTenant);

// Lista (alimenta o autocomplete; suporta ?q= por prefixo) — qualquer papel autenticado.
tagsRoutes.get('/', tagsController.list);

tagsRoutes.post(
  '/',
  requireRole('OWNER', 'ADMIN', 'AGENT'),
  validate(CreateTagSchema),
  tagsController.create,
);

tagsRoutes.patch(
  '/:id',
  requireRole('OWNER', 'ADMIN', 'AGENT'),
  validate(TagIdParamSchema, 'params'),
  validate(UpdateTagSchema),
  tagsController.update,
);

tagsRoutes.delete(
  '/:id',
  requireRole('OWNER', 'ADMIN'),
  validate(TagIdParamSchema, 'params'),
  tagsController.remove,
);
