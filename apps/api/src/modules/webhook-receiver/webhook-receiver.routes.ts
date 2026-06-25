import { Router } from 'express';
import { webhookReceiverController } from './webhook-receiver.controller.js';

// Sem autenticação JWT: a Evolution se autentica pela URL (key da instância).
// A identificação do tenant é feita pela instância (evolutionKey = :key).
export const webhookReceiverRoutes: Router = Router();

// Entrega no base (/:key) ou por evento (/:key/:event), conforme config da Evolution.
webhookReceiverRoutes.post('/:key', webhookReceiverController.receive);
webhookReceiverRoutes.post('/:key/:event', webhookReceiverController.receive);
