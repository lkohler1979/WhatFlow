import { Router } from 'express';
import { conversationsController } from './conversations.controller.js';
import { validate } from '@middlewares/validate.middleware.js';
import { authMiddleware, requireRole } from '@middlewares/auth.middleware.js';
import { requireTenant } from '@middlewares/tenant-context.middleware.js';
import { ConversationIdParamSchema, UpdateConversationSchema } from './conversations.schema.js';
import { messagesRoutes } from '@modules/messages/messages.routes.js';
import { messagesController } from '@modules/messages/messages.controller.js';
import { CreateNoteSchema } from '@modules/messages/messages.schema.js';
import { tagsController } from '@modules/tags/tags.controller.js';
import { AttachTagSchema, ConversationTagParamsSchema } from '@modules/tags/tags.schema.js';

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

// ── Notas internas (T-040) — registradas na conversa, nunca enviadas ao WhatsApp.
// VIEWER não cria notas (apenas papéis operacionais).
conversationsRoutes.post(
  '/:id/notes',
  requireRole('OWNER', 'ADMIN', 'AGENT'),
  validate(ConversationIdParamSchema, 'params'),
  validate(CreateNoteSchema),
  messagesController.addNote,
);

// ── Tags de uma conversa (T-040) — anexar/remover. Tenant-scoped no service.
conversationsRoutes.post(
  '/:id/tags',
  requireRole('OWNER', 'ADMIN', 'AGENT'),
  validate(ConversationIdParamSchema, 'params'),
  validate(AttachTagSchema),
  tagsController.attachToConversation,
);
conversationsRoutes.delete(
  '/:id/tags/:tagId',
  requireRole('OWNER', 'ADMIN', 'AGENT'),
  validate(ConversationTagParamsSchema, 'params'),
  tagsController.detachFromConversation,
);

// Mensagens são aninhadas na conversa: /v1/conversations/:id/messages
// (messagesRoutes usa mergeParams para enxergar :id).
conversationsRoutes.use('/:id/messages', messagesRoutes);
