import type { Job } from 'bullmq';
import { logger } from '@core/logger.js';
import { emitToTenant } from '@core/realtime.js';
import { evolutionApiService } from '@integrations/evolution-api/evolution-api.service.js';
import { campaignsRepository } from '@modules/campaigns/campaigns.repository.js';
import { webhooksService } from '@modules/webhooks/webhooks.service.js';

/** Payload enfileirado por campaignsService.start() (T-032). */
export interface CampaignJobData {
  campaignId: string;
  tenantId: string;
}

/** A cada quantos contatos re-checamos o status (pausa/cancelamento). */
const STATUS_CHECK_EVERY = 1;

/** Delay aleatório inclusivo entre [min, max] (anti-ban). */
function randomDelay(minMs: number, maxMs: number): number {
  const lo = Math.max(0, Math.min(minMs, maxMs));
  const hi = Math.max(minMs, maxMs);
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Processor de disparo de campanha com anti-ban (T-033).
 *
 * Fluxo: carrega a campanha + evolutionKey + contatos PENDING; itera enviando a
 * mensagem (sendText para TEXT; sendMedia para mídia, com fallback para texto
 * quando não há mediaUrl). Entre cada envio aplica um delay aleatório
 * `[delayMinMs, delayMaxMs]`. Após cada contato re-checa o status no banco:
 * se PAUSED/CANCELLED, interrompe graciosamente (sem marcar COMPLETED). Emite
 * `campaign:progress` por envio e marca COMPLETED ao esgotar os contatos.
 *
 * Robustez: a falha de um contato NÃO aborta a campanha — incrementa
 * failedCount, marca o CampaignContact como FAILED e segue. A persistência da
 * Message OUTBOUND é best-effort (não derruba o envio).
 */
export async function campaignProcessor(job: Job<CampaignJobData>): Promise<{
  sent: number;
  failed: number;
  total: number;
  status: string;
}> {
  const { campaignId, tenantId } = job.data;
  const log = logger.child({ queue: 'campaign', campaignId, tenantId });

  const campaign = await campaignsRepository.findByIdInTenant(campaignId, tenantId);
  if (!campaign) {
    log.warn('Campanha não encontrada no tenant — job ignorado');
    return { sent: 0, failed: 0, total: 0, status: 'NOT_FOUND' };
  }

  // Só processa campanhas em execução (start() já transicionou para RUNNING).
  if (campaign.status !== 'RUNNING') {
    log.info({ status: campaign.status }, 'Campanha não está RUNNING — nada a disparar');
    return { sent: 0, failed: 0, total: campaign.totalContacts, status: campaign.status };
  }

  const evolutionKey = await campaignsRepository.getEvolutionKeyForCampaign(campaignId, tenantId);
  if (!evolutionKey) {
    log.error('Instância/evolutionKey não encontrada — marcando campanha como FAILED');
    await campaignsRepository.updateStatus(campaignId, tenantId, 'FAILED', {
      completedAt: new Date(),
    });
    return { sent: 0, failed: 0, total: campaign.totalContacts, status: 'FAILED' };
  }

  const pending = await campaignsRepository.pendingContacts(campaignId);
  const total = campaign.totalContacts || pending.length;
  // Já contabilizados de execuções anteriores (retomada de PAUSED).
  let sent = campaign.sentCount;
  let failed = campaign.failedCount;

  const isText = campaign.messageType === 'TEXT' || !campaign.mediaUrl;

  log.info({ pending: pending.length, total }, 'Iniciando disparo da campanha');

  let stoppedBy: 'PAUSED' | 'CANCELLED' | null = null;

  for (let i = 0; i < pending.length; i += 1) {
    // Re-checa o status no banco (responsivo a pausa/cancelamento).
    if (i % STATUS_CHECK_EVERY === 0) {
      const current = await campaignsRepository.getStatus(campaignId, tenantId);
      if (current === 'PAUSED' || current === 'CANCELLED') {
        stoppedBy = current;
        log.info({ status: current, at: i }, 'Disparo interrompido graciosamente');
        break;
      }
    }

    const cc = pending[i];
    try {
      let externalId: string | null = null;
      if (isText) {
        // TEXT (ou mídia sem URL → fallback para o conteúdo/caption como texto).
        const text = campaign.messageContent ?? campaign.mediaCaption ?? '';
        const res = (await evolutionApiService.sendText(evolutionKey, {
          number: cc.phone,
          text,
        })) as { key?: { id?: string } } | null;
        externalId = res?.key?.id ?? null;
      } else {
        const mediatype =
          campaign.messageType === 'IMAGE'
            ? 'image'
            : campaign.messageType === 'VIDEO'
              ? 'video'
              : campaign.messageType === 'AUDIO'
                ? 'audio'
                : 'document';
        const res = (await evolutionApiService.sendMedia(evolutionKey, {
          number: cc.phone,
          mediatype,
          media: campaign.mediaUrl as string,
          caption: campaign.mediaCaption ?? undefined,
        })) as { key?: { id?: string } } | null;
        externalId = res?.key?.id ?? null;
      }

      await campaignsRepository.updateContactStatus(cc.id, 'SENT', { externalId });
      await campaignsRepository.incrementCounters(campaignId, tenantId, { sent: 1 });
      sent += 1;

      // Persistência da Message OUTBOUND é best-effort.
      try {
        await campaignsRepository.recordOutboundMessage({
          tenantId,
          instanceId: campaign.instanceId,
          contactId: cc.contactId,
          content: isText ? (campaign.messageContent ?? campaign.mediaCaption ?? '') : null,
          type: campaign.messageType,
          mediaUrl: isText ? null : campaign.mediaUrl,
          mediaCaption: campaign.mediaCaption,
          externalId,
        });
      } catch (err) {
        log.warn(
          { err, campaignContactId: cc.id },
          'Falha ao registrar Message OUTBOUND (ignorado)',
        );
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      log.warn({ err, phone: cc.phone }, 'Falha no envio para contato (campanha continua)');
      await campaignsRepository
        .updateContactStatus(cc.id, 'FAILED', { errorMessage: errorMessage.slice(0, 500) })
        .catch(() => undefined);
      await campaignsRepository
        .incrementCounters(campaignId, tenantId, { failed: 1 })
        .catch(() => undefined);
      failed += 1;
    }

    // Progresso em tempo real após cada contato.
    emitToTenant(tenantId, 'campaign:progress', {
      campaignId,
      sent,
      failed,
      total,
      status: 'RUNNING',
    });

    // Delay anti-ban entre envios (não dorme após o último contato).
    if (i < pending.length - 1) {
      await sleep(randomDelay(campaign.delayMinMs, campaign.delayMaxMs));
    }
  }

  if (stoppedBy) {
    // Pausa/cancelamento: NÃO marca COMPLETED. Emite estado final do loop.
    emitToTenant(tenantId, 'campaign:progress', {
      campaignId,
      sent,
      failed,
      total,
      status: stoppedBy,
    });
    return { sent, failed, total, status: stoppedBy };
  }

  await campaignsRepository.updateStatus(campaignId, tenantId, 'COMPLETED', {
    completedAt: new Date(),
  });
  emitToTenant(tenantId, 'campaign:progress', {
    campaignId,
    sent,
    failed,
    total,
    status: 'COMPLETED',
  });
  log.info({ sent, failed, total }, 'Campanha concluída');

  // Webhooks de saída (T-047): dispara `CAMPAIGN_COMPLETED`. Best-effort —
  // dispatchEvent apenas enfileira e não propaga erro.
  void webhooksService
    .dispatchEvent(tenantId, 'CAMPAIGN_COMPLETED', { campaignId, sent, failed, total })
    .catch(err => log.warn({ err }, 'Falha ao despachar webhook CAMPAIGN_COMPLETED'));

  return { sent, failed, total, status: 'COMPLETED' };
}
