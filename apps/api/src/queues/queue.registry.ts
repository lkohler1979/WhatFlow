import type { Queue, JobsOptions } from 'bullmq';
import { createQueue } from './queue.factory.js';

/** Payload da fila de exemplo/saúde (T-031). */
export interface ExampleJobData {
  /** Texto qualquer só para logar no processor. */
  message?: string;
  /** Se true, o processor lança erro — usado para validar o retry automático. */
  fail?: boolean;
}

/**
 * Fila de exemplo/saúde. Serve para validar o pipeline BullMQ ponta-a-ponta
 * (enfileirar → processar → retry) e aparece no Bull-Board.
 */
export const exampleQueue = createQueue<ExampleJobData>('example');

/**
 * Filas de produção. Os workers/processors de `campaign` e `webhook-delivery`
 * chegam nas tarefas T-032/T-033; aqui já deixamos as filas registradas com os
 * defaults de retry para o Bull-Board enxergá-las.
 */
export const campaignQueue = createQueue('campaign');
export const webhookDeliveryQueue = createQueue('webhook-delivery', {
  attempts: 5,
  backoff: { type: 'exponential', delay: 10_000 },
  removeOnComplete: { count: 200 },
  removeOnFail: { count: 1_000 },
});

export const queues = { exampleQueue, campaignQueue, webhookDeliveryQueue };

/**
 * Helper genérico para enfileirar um job. As opções da fila (retry/backoff) já
 * vêm dos defaults; `opts` permite ajustes pontuais (ex.: delay anti-ban em T-032).
 */
export async function addJob<T>(queue: Queue<T>, name: string, data: T, opts?: JobsOptions) {
  // BullMQ usa tipos utilitários estreitos (ExtractNameType/ExtractDataType)
  // sobre o genérico da fila; relaxamos aqui pois expomos um helper genérico
  // sobre qualquer Queue<T>.
  return (queue.add as (n: string, d: T, o?: JobsOptions) => ReturnType<Queue<T>['add']>)(
    name,
    data,
    opts,
  );
}
