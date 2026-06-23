import { Queue, type ConnectionOptions } from 'bullmq';
import { redis } from '@core/redis.js';

// BullMQ empacota sua própria cópia de ioredis; o cast evita o conflito
// de tipos entre as duas instâncias de ioredis (a do root e a aninhada).
const connection = redis as unknown as ConnectionOptions;

export const campaignQueue = new Queue('campaign', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

export const webhookDeliveryQueue = new Queue('webhook-delivery', {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 10_000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 1000 },
  },
});

export const queues = { campaignQueue, webhookDeliveryQueue };
