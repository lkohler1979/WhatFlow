import { Router } from 'express';
import { aiController } from './ai.controller.js';
import { validate } from '@middlewares/validate.middleware.js';
import { authMiddleware, requireRole } from '@middlewares/auth.middleware.js';
import { requireTenant } from '@middlewares/tenant-context.middleware.js';
import { UpsertAiConfigSchema, TestAiConfigSchema } from './ai.schema.js';

export const aiRoutes: Router = Router();

aiRoutes.use(authMiddleware, requireTenant);

// Leitura/teste disponíveis a qualquer papel do tenant.
aiRoutes.get('/config', aiController.getConfig);
aiRoutes.post('/test', validate(TestAiConfigSchema), aiController.test);

// Salvar/editar a config exige OWNER/ADMIN.
aiRoutes.put(
  '/config',
  requireRole('OWNER', 'ADMIN'),
  validate(UpsertAiConfigSchema),
  aiController.upsertConfig,
);
