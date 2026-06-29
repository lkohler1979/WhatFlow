import {
  Queue,
  Worker,
  type ConnectionOptions,
  type JobsOptions,
  type Processor,
  type WorkerOptions,
} from 'bullmq';
import { redis } from '@core/redis.js';
import { logger } from '@core/logger.js';

// BullMQ empacota sua própria cópia de ioredis; o cast evita o conflito de
// tipos entre as duas instâncias de ioredis (a do root e a aninhada no bullmq).
export const connection = redis as unknown as ConnectionOptions;

/**
 * Opções padrão de job para todas as filas: retry automático com backoff
 * exponencial e limpeza de jobs concluídos/falhos para não inflar o Redis.
 *
 * Critério de aceite (T-031): "Retry automático em falha".
 */
export const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2_000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};

/**
 * Cria uma Queue com os defaults de retry. Permite sobrescrever pontualmente
 * (ex.: a fila de webhooks usa mais tentativas).
 */
export function createQueue<T = unknown>(
  name: string,
  overrides: Partial<JobsOptions> = {},
): Queue<T> {
  return new Queue<T>(name, {
    connection,
    defaultJobOptions: { ...defaultJobOptions, ...overrides },
  });
}

/**
 * Cria e inicia um Worker para uma fila. O worker já loga ciclo de vida
 * (concluído/falhou) — útil para validar o processamento e o retry.
 */
export function createWorker<T = unknown>(
  name: string,
  processor: Processor<T>,
  options: Partial<WorkerOptions> = {},
): Worker<T> {
  const worker = new Worker<T>(name, processor, {
    connection,
    concurrency: 5,
    ...options,
  });

  worker.on('completed', job => {
    logger.info({ queue: name, jobId: job.id }, 'Job concluído');
  });
  worker.on('failed', (job, err) => {
    logger.warn(
      { queue: name, jobId: job?.id, attempts: job?.attemptsMade, err: err.message },
      'Job falhou (será re-tentado se ainda houver tentativas)',
    );
  });
  worker.on('error', err => {
    logger.error({ queue: name, err }, 'Erro no worker');
  });

  return worker;
}
