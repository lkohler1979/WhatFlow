import rateLimit from 'express-rate-limit';
import { config } from '@core/config.js';

export const globalRateLimit = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMIT', message: 'Muitas requisições. Tente novamente em breve.' },
});

export const messageSendRateLimit = rateLimit({
  windowMs: 60_000,
  max: 20, // Anti-ban: máx 20 msgs/min por IP
  keyGenerator: req => `${req.tenantId ?? req.ip}`,
  message: { error: 'RATE_LIMIT', message: 'Limite de envio atingido.' },
});
