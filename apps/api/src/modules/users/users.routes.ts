import { Router } from 'express';
import { usersController } from './users.controller.js';
import { validate } from '@middlewares/validate.middleware.js';
import { authMiddleware, requireRole } from '@middlewares/auth.middleware.js';
import { requireTenant } from '@middlewares/tenant-context.middleware.js';
import { InviteUserSchema, UpdateRoleSchema, UserIdParamSchema } from './users.schema.js';

export const usersRoutes: Router = Router();

// Todas as rotas exigem autenticação + tenant
usersRoutes.use(authMiddleware, requireTenant);

usersRoutes.get('/', usersController.list);

usersRoutes.post(
  '/invite',
  requireRole('OWNER', 'ADMIN'),
  validate(InviteUserSchema),
  usersController.invite,
);

usersRoutes.patch(
  '/:id/role',
  requireRole('OWNER', 'ADMIN'),
  validate(UserIdParamSchema, 'params'),
  validate(UpdateRoleSchema),
  usersController.updateRole,
);

usersRoutes.delete(
  '/:id',
  requireRole('OWNER'),
  validate(UserIdParamSchema, 'params'),
  usersController.remove,
);
