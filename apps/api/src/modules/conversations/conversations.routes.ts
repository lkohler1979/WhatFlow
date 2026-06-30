import { Router } from 'express';
import { conversationsController } from './conversations.controller.js';
import { validate } from '@middlewares/validate.middleware.js';
import { authMiddleware } from '@middlewares/auth.middleware.js';
import { requireTenant } from '@middlewares/tenant-context.middleware.js';
import { UpdateConversationSchema } from './conversations.schema.js';
import { messagesRoutes } from '@modules/messages/messages.routes.js';

export const conversationsRoutes: Router = Router();

conversationsRoutes.use(authMiddleware, requireTenant);

conversationsRoutes.get('/', conversationsController.list);
conversationsRoutes.get('/:id', conversationsController.get);
conversationsRoutes.patch(
  '/:id',
  validate(UpdateConversationSchema),
  conversationsController.update,
);
conversationsRoutes.post('/:id/read', conversationsController.markRead);

// Mensagens são aninhadas na conversa: /v1/conversations/:id/messages
// (messagesRoutes usa mergeParams para enxergar :id).
conversationsRoutes.use('/:id/messages', messagesRoutes);
