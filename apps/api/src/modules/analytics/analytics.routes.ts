import { Router } from 'express';
import { analyticsController } from './analytics.controller.js';
import { authMiddleware } from '@middlewares/auth.middleware.js';
import { requireTenant } from '@middlewares/tenant-context.middleware.js';

export const analyticsRoutes: Router = Router();

analyticsRoutes.use(authMiddleware, requireTenant);

// KPIs consolidados do período (default: últimos 30 dias).
analyticsRoutes.get('/overview', analyticsController.overview);
// Série temporal de mensagens (INBOUND/OUTBOUND por dia|semana).
analyticsRoutes.get('/messages', analyticsController.messages);
// Resumo de campanhas (por status + somatórios de envio).
analyticsRoutes.get('/campaigns', analyticsController.campaigns);
