import axios, { AxiosInstance } from 'axios';
import { config } from '@core/config.js';
import { logger } from '@core/logger.js';

let _client: AxiosInstance | null = null;

export function getEvolutionClient(): AxiosInstance {
  if (_client) return _client;

  _client = axios.create({
    baseURL: config.EVOLUTION_API_URL,
    headers: { apikey: config.EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
    timeout: 15_000,
  });

  _client.interceptors.response.use(
    res => res,
    err => {
      logger.error({ err: err?.response?.data, url: err?.config?.url }, 'Evolution API error');
      return Promise.reject(err);
    },
  );

  return _client;
}
