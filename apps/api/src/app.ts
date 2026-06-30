import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createServer, type Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { config } from '@core/config.js';
import { logger } from '@core/logger.js';
import { setIo } from '@core/realtime.js';
import { globalRateLimit } from '@middlewares/rate-limit.middleware.js';
import { requestIdMiddleware } from '@middlewares/request-id.middleware.js';
import { errorHandlerMiddleware } from '@middlewares/error-handler.middleware.js';

// ── Módulos (descomentar conforme implementar) ──
import { authRoutes } from '@modules/auth/auth.routes.js';
import { usersRoutes } from '@modules/users/users.routes.js';
import { instancesRoutes } from '@modules/instances/instances.routes.js';
import { flowsRoutes } from '@modules/flows/flows.routes.js';
import { webhookReceiverRoutes } from '@modules/webhook-receiver/webhook-receiver.routes.js';
import { campaignsRoutes } from '@modules/campaigns/campaigns.routes.js';
import { contactsRoutes } from '@modules/contacts/contacts.routes.js';
import { aiRoutes } from '@modules/ai/ai.routes.js';
import { conversationsRoutes } from '@modules/conversations/conversations.routes.js';
import { tagsRoutes } from '@modules/tags/tags.routes.js';
// import { flowsRoutes }            from '@modules/flows/flows.routes.js';
// import { conversationsRoutes }    from '@modules/conversations/conversations.routes.js';
// import { messagesRoutes }         from '@modules/messages/messages.routes.js';
// import { campaignsRoutes }        from '@modules/campaigns/campaigns.routes.js';
// import { aiRoutes }               from '@modules/ai/ai.routes.js';
// import { webhooksRoutes }         from '@modules/webhooks/webhooks.routes.js';
// import { analyticsRoutes }        from '@modules/analytics/analytics.routes.js';
// import { webhookReceiverRoutes }  from '@modules/webhook-receiver/webhook-receiver.routes.js';

export function createApp(): { app: Express; httpServer: HttpServer; io: SocketServer } {
  const app = express();
  const httpServer = createServer(app);

  // ── Socket.io (Inbox realtime) ──
  const io = new SocketServer(httpServer, {
    cors: { origin: config.CORS_ORIGINS.split(','), credentials: true },
  });
  setIo(io);

  io.on('connection', socket => {
    logger.debug({ socketId: socket.id }, 'Socket conectado');
    socket.on('join:tenant', (tenantId: string) => socket.join(`tenant:${tenantId}`));
    socket.on('disconnect', () => logger.debug({ socketId: socket.id }, 'Socket desconectado'));
  });

  // ── Middlewares globais ──
  app.use(requestIdMiddleware);
  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGINS.split(','), credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(`${config.API_PREFIX}`, globalRateLimit);

  // ── Health check ──
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: '0.1.0', timestamp: new Date().toISOString() });
  });

  // ── Rotas da API ──
  const router = express.Router();
  router.use('/auth', authRoutes);
  router.use('/users', usersRoutes);
  router.use('/instances', instancesRoutes);
  router.use('/flows', flowsRoutes);
  router.use('/webhooks/evolution', webhookReceiverRoutes);
  router.use('/campaigns', campaignsRoutes);
  router.use('/contacts', contactsRoutes);
  router.use('/ai', aiRoutes);
  router.use('/conversations', conversationsRoutes);
  router.use('/tags', tagsRoutes);
  // router.use('/flows',     flowsRoutes);
  // ... (descomentar conforme implementar)

  app.use(config.API_PREFIX, router);

  // ── Error handler (último middleware) ──
  app.use(errorHandlerMiddleware);

  return { app, httpServer, io };
}
