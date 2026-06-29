import { createWorker } from '../queue.factory.js';
import { campaignProcessor, type CampaignJobData } from '../processors/campaign.processor.js';

/**
 * Worker da fila `campaign` (T-033). Concurrency baixa: o disparo já é serial
 * por campanha (com delays anti-ban), e manter poucas campanhas em paralelo
 * evita martelar a Evolution API e reduz risco de ban do número.
 */
export const campaignWorker = createWorker<CampaignJobData>('campaign', campaignProcessor, {
  concurrency: 2,
});
