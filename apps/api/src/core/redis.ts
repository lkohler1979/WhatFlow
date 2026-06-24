import Redis from 'ioredis';
import { config } from './config.js';
import { logger } from './logger.js';

export const redis = new Redis(config.REDIS_URL, {
  password: config.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Necessário para BullMQ
  lazyConnect: true,
});

redis.on('connect', () => logger.info('Redis conectado'));
redis.on('error', err => logger.error({ err }, 'Redis error'));

export default redis;
