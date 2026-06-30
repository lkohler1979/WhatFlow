import { Router } from 'express';
import { messagesController } from './messages.controller.js';
import { validate } from '@middlewares/validate.middleware.js';
import { authMiddleware } from '@middlewares/auth.middleware.js';
import { requireTenant } from '@middlewares/tenant-context.middleware.js';
import { requireRole } from '@middlewares/auth.middleware.js';
import { SendMessageSchema } from './messages.schema.js';

/**
 * Rotas de mensagens, aninhadas em /v1/conversations/:id/messages.
 * `mergeParams` expõe o :id (conversationId) do router pai.
 * VIEWER não envia mensagens (apenas papéis operacionais).
 */
export const messagesRoutes: Router = Router({ mergeParams: true });

messagesRoutes.use(authMiddleware, requireTenant);

messagesRoutes.get('/', messagesController.list);
messagesRoutes.post(
  '/',
  requireRole('OWNER', 'ADMIN', 'AGENT'),
  validate(SendMessageSchema),
  messagesController.send,
);
