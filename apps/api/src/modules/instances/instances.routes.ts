import { Router } from 'express';
import { instancesController } from './instances.controller.js';
import { validate } from '@middlewares/validate.middleware.js';
import { authMiddleware, requireRole } from '@middlewares/auth.middleware.js';
import { requireTenant } from '@middlewares/tenant-context.middleware.js';
import { CreateInstanceSchema } from './instances.schema.js';

export const instancesRoutes: Router = Router();

instancesRoutes.use(authMiddleware, requireTenant);

instancesRoutes.get('/', instancesController.list);
instancesRoutes.get('/:id', instancesController.get);
instancesRoutes.get('/:id/qrcode', instancesController.qrCode);
instancesRoutes.post(
  '/',
  requireRole('OWNER', 'ADMIN'),
  validate(CreateInstanceSchema),
  instancesController.create,
);
instancesRoutes.delete('/:id', requireRole('OWNER', 'ADMIN'), instancesController.remove);
