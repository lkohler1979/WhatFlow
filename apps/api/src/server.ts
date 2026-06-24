import { createApp } from './app.js';
import { config } from '@core/config.js';
import { logger } from '@core/logger.js';

const { httpServer } = createApp();

httpServer.listen(config.PORT, () => {
  logger.info(`🚀 WhatFlow API → http://localhost:${config.PORT}${config.API_PREFIX}`);
  logger.info(`🌍 Ambiente: ${config.NODE_ENV}`);
});

const shutdown = (signal: string) => {
  logger.info(`Sinal ${signal} recebido — encerrando gracefully...`);
  httpServer.close(() => {
    logger.info('✅ Servidor encerrado.');
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('⛔ Forçando saída');
    process.exit(1);
  }, 10_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', err => {
  logger.fatal({ err }, 'uncaughtException');
  process.exit(1);
});
process.on('unhandledRejection', err => {
  logger.fatal({ err }, 'unhandledRejection');
  process.exit(1);
});
