import { createWorker } from '../queue.factory.js';
import {
  webhookDeliveryProcessor,
  type WebhookDeliveryJobData,
} from '../processors/webhook-delivery.processor.js';

/**
 * Worker da fila `webhook-delivery` (T-047). Entrega webhooks de saída com
 * assinatura HMAC e medição de tempo; o retry/backoff vem da config da fila
 * (attempts:5, backoff exponencial 10s — ver queue.registry.ts).
 */
export const webhookWorker = createWorker<WebhookDeliveryJobData>(
  'webhook-delivery',
  webhookDeliveryProcessor,
  { concurrency: 5 },
);
