import { createWorker } from '../queue.factory.js';
import { exampleProcessor } from '../processors/example.processor.js';
import type { ExampleJobData } from '../queue.registry.js';

/** Worker da fila de exemplo/saúde (T-031). */
export const exampleWorker = createWorker<ExampleJobData>('example', exampleProcessor);
