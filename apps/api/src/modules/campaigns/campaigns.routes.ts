import { Router } from 'express';
import { campaignsController } from './campaigns.controller.js';
import { validate } from '@middlewares/validate.middleware.js';
import { authMiddleware, requireRole } from '@middlewares/auth.middleware.js';
import { requireTenant } from '@middlewares/tenant-context.middleware.js';
import { CreateCampaignSchema, UpdateCampaignSchema } from './campaigns.schema.js';

export const campaignsRoutes: Router = Router();

campaignsRoutes.use(authMiddleware, requireTenant);

campaignsRoutes.get('/', campaignsController.list);
campaignsRoutes.get('/:id', campaignsController.get);
campaignsRoutes.post(
  '/',
  requireRole('OWNER', 'ADMIN'),
  validate(CreateCampaignSchema),
  campaignsController.create,
);
campaignsRoutes.patch(
  '/:id',
  requireRole('OWNER', 'ADMIN'),
  validate(UpdateCampaignSchema),
  campaignsController.update,
);
campaignsRoutes.post('/:id/start', requireRole('OWNER', 'ADMIN'), campaignsController.start);
campaignsRoutes.post('/:id/pause', requireRole('OWNER', 'ADMIN'), campaignsController.pause);
campaignsRoutes.post('/:id/cancel', requireRole('OWNER', 'ADMIN'), campaignsController.cancel);
campaignsRoutes.delete('/:id', requireRole('OWNER', 'ADMIN'), campaignsController.remove);
