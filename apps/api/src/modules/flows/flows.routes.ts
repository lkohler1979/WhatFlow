import { Router } from 'express';
import { flowsController } from './flows.controller.js';
import { validate } from '@middlewares/validate.middleware.js';
import { authMiddleware } from '@middlewares/auth.middleware.js';
import { requireTenant } from '@middlewares/tenant-context.middleware.js';
import { CreateFlowSchema, UpdateFlowSchema } from './flows.schema.js';

export const flowsRoutes: Router = Router();

flowsRoutes.use(authMiddleware, requireTenant);

flowsRoutes.get('/', flowsController.list);
flowsRoutes.post('/', validate(CreateFlowSchema), flowsController.create);
flowsRoutes.get('/:id', flowsController.get);
flowsRoutes.patch('/:id', validate(UpdateFlowSchema), flowsController.update);
flowsRoutes.post('/:id/publish', flowsController.publish);
flowsRoutes.post('/:id/duplicate', flowsController.duplicate);
flowsRoutes.delete('/:id', flowsController.remove);
