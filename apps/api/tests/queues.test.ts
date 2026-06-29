// Mocka o bullmq para não exigir Redis real (Queue/Worker viram stubs).
jest.mock('bullmq', () => {
  class FakeQueue {
    name: string;
    opts: unknown;
    add = jest.fn().mockResolvedValue({ id: '1' });
    close = jest.fn().mockResolvedValue(undefined);
    constructor(name: string, opts: unknown) {
      this.name = name;
      this.opts = opts;
    }
  }
  class FakeWorker {
    name: string;
    processor: unknown;
    opts: unknown;
    on = jest.fn();
    close = jest.fn().mockResolvedValue(undefined);
    constructor(name: string, processor: unknown, opts: unknown) {
      this.name = name;
      this.processor = processor;
      this.opts = opts;
    }
  }
  return { Queue: FakeQueue, Worker: FakeWorker };
});

// Evita instanciar ioredis (que tentaria resolver o host).
jest.mock('@core/redis.js', () => ({ redis: {} }));

import {
  createQueue,
  createWorker,
  defaultJobOptions,
} from '@queues/queue.factory.js';
import { addJob } from '@queues/queue.registry.js';

describe('queue.factory — defaults de retry', () => {
  it('expõe attempts: 3 e backoff exponencial de 2000ms', () => {
    expect(defaultJobOptions.attempts).toBe(3);
    expect(defaultJobOptions.backoff).toEqual({ type: 'exponential', delay: 2_000 });
  });

  it('createQueue aplica os defaults de retry', () => {
    const q = createQueue('test') as unknown as { opts: { defaultJobOptions: typeof defaultJobOptions } };
    expect(q.opts.defaultJobOptions.attempts).toBe(3);
    expect(q.opts.defaultJobOptions.removeOnComplete).toEqual({ count: 100 });
  });

  it('createQueue permite sobrescrever (ex.: webhook-delivery com 5 tentativas)', () => {
    const q = createQueue('wh', { attempts: 5 }) as unknown as {
      opts: { defaultJobOptions: { attempts: number } };
    };
    expect(q.opts.defaultJobOptions.attempts).toBe(5);
  });

  it('createWorker recebe concurrency padrão', () => {
    const w = createWorker('test', async () => undefined) as unknown as {
      opts: { concurrency: number };
    };
    expect(w.opts.concurrency).toBe(5);
  });
});

describe('addJob', () => {
  it('delega para queue.add com nome, data e opts', async () => {
    const queue = createQueue('test');
    await addJob(queue, 'job1', { foo: 'bar' }, { delay: 1_000 });
    expect((queue.add as jest.Mock)).toHaveBeenCalledWith('job1', { foo: 'bar' }, { delay: 1_000 });
  });
});
