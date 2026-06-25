import { Router } from 'express';
import { webhookReceiverController } from './webhook-receiver.controller.js';

// Sem autenticação JWT: a Evolution se autentica pela URL (key da instância).
// A identificação do tenant é feita pela instância (evolutionKey = :key).
export const webhookReceiverRoutes: Router = Router();

webhookReceiverRoutes.post('/:key', webhookReceiverController.receive);
