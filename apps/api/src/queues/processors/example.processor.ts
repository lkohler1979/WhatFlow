import type { Job } from 'bullmq';
import { logger } from '@core/logger.js';
import type { ExampleJobData } from '../queue.registry.js';

/**
 * Processor da fila de exemplo/saúde (T-031).
 * - Loga o job (prova que foi processado).
 * - Se `data.fail === true`, lança erro de propósito para exercitar o retry
 *   automático configurado nas defaultJobOptions (attempts: 3 + backoff).
 */
export async function exampleProcessor(job: Job<ExampleJobData>): Promise<{ ok: true }> {
  logger.info(
    { jobId: job.id, attempt: job.attemptsMade + 1, data: job.data },
    'Processando job da fila example',
  );

  if (job.data.fail) {
    throw new Error(`Falha proposital para validar retry (tentativa ${job.attemptsMade + 1})`);
  }

  return { ok: true };
}
