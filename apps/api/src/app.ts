import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createServer, type Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { config } from '@core/config.js';
import { logger } from '@core/logger.js';
import { globalRateLimit } from '@middlewares/rate-limit.middleware.js';
import { requestIdMiddleware } from '@middlewares/request-id.middleware.js';
import { errorHandlerMiddleware } from '@middlewares/error-handler.middleware.js';

// ── Módulos (descomentar conforme implementar) ──
import { authRoutes } from '@modules/auth/auth.routes.js';
// import { instancesRoutes }        from '@modules/instances/instances.routes.js';
// import { flowsRoutes }            from '@modules/flows/flows.routes.js';
// import { contactsRoutes }         from '@modules/contacts/contacts.routes.js';
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
  // router.use('/instances', instancesRoutes);
  // router.use('/flows',     flowsRoutes);
  // router.use('/contacts',  contactsRoutes);
  // ... (descomentar conforme implementar)

  app.use(config.API_PREFIX, router);

  // ── Error handler (último middleware) ──
  app.use(errorHandlerMiddleware);

  return { app, httpServer, io };
}
