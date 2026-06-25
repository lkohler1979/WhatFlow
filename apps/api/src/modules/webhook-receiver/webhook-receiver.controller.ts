import { Request, Response } from 'express';
import { logger } from '@core/logger.js';
import { webhookReceiverService } from './webhook-receiver.service.js';

export const webhookReceiverController = {
  /**
   * Recebe eventos da Evolution API. Responde 200 sempre (mesmo em erro de
   * processamento) para a Evolution não reenfileirar; o processamento é logado.
   */
  async receive(req: Request, res: Response): Promise<void> {
    const key = req.params.key as string;
    const body = req.body as { event?: string; data?: unknown };
    res.status(200).json({ received: true });
    try {
      if (body?.event) {
        await webhookReceiverService.handle(key, body.event, body.data);
      }
    } catch (err) {
      logger.error({ err, key, event: body?.event }, 'Falha ao processar webhook da Evolution');
    }
  },
};
