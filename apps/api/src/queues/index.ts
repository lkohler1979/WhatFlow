import type { Worker } from 'bullmq';
import { logger } from '@core/logger.js';
import { queues } from './queue.registry.js';
import { exampleWorker } from './workers/example.worker.js';
import { campaignWorker } from './workers/campaign.worker.js';

export * from './queue.registry.js';
export * from './queue.factory.js';

/**
 * Workers ativos. O worker de campaign (T-033) faz o disparo com anti-ban.
 * O de webhook-delivery chega em tarefa posterior.
 */
const workers: Worker[] = [exampleWorker, campaignWorker];

/**
 * Sobe a infra de filas junto com o servidor. A connection do ioredis usa
 * `lazyConnect`, então os workers só abrem socket quando este boot roda — assim
 * importar o módulo (ex.: em testes) não força conexão com o Redis.
 */
export function startQueues(): void {
  logger.info(
    { queues: Object.keys(queues), workers: workers.length },
    '🧵 Filas BullMQ inicializadas',
  );
}

/**
 * Encerramento gracioso: fecha workers e queues para drenar conexões do Redis.
 * Chamado no SIGTERM/SIGINT pelo server.ts.
 */
export async function stopQueues(): Promise<void> {
  await Promise.allSettled([
    ...workers.map(w => w.close()),
    ...Object.values(queues).map(q => q.close()),
  ]);
  logger.info('🧵 Filas BullMQ encerradas');
}
