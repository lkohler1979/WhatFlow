import { Router } from 'express';
import { webhooksController } from './webhooks.controller.js';
import { validate } from '@middlewares/validate.middleware.js';
import { authMiddleware, requireRole } from '@middlewares/auth.middleware.js';
import { requireTenant } from '@middlewares/tenant-context.middleware.js';
import { CreateWebhookSchema, UpdateWebhookSchema } from './webhooks.schema.js';

export const webhooksRoutes: Router = Router();

webhooksRoutes.use(authMiddleware, requireTenant);

webhooksRoutes.get('/', webhooksController.list);
webhooksRoutes.get('/:id', webhooksController.get);
webhooksRoutes.get('/:id/deliveries', webhooksController.deliveries);
webhooksRoutes.post(
  '/',
  requireRole('OWNER', 'ADMIN'),
  validate(CreateWebhookSchema),
  webhooksController.create,
);
webhooksRoutes.patch(
  '/:id',
  requireRole('OWNER', 'ADMIN'),
  validate(UpdateWebhookSchema),
  webhooksController.update,
);
webhooksRoutes.post('/:id/test', requireRole('OWNER', 'ADMIN'), webhooksController.test);
webhooksRoutes.delete('/:id', requireRole('OWNER', 'ADMIN'), webhooksController.remove);
