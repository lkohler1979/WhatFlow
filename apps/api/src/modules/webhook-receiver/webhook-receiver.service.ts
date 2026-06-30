import { logger } from '@core/logger.js';
import { emitToTenant } from '@core/realtime.js';
import { webhookReceiverRepository as repo } from './webhook-receiver.repository.js';
import { flowRunner } from '@modules/flow-engine/flow-engine.runner.js';
import { webhooksService } from '@modules/webhooks/webhooks.service.js';
import type { Instance, InstanceStatus } from '@prisma/client';

function mapState(raw?: string): InstanceStatus {
  switch (raw) {
    case 'open':
      return 'CONNECTED';
    case 'connecting':
      return 'QR_PENDING';
    case 'close':
      return 'DISCONNECTED';
    default:
      return 'PENDING';
  }
}

/** Extrai os dígitos identificadores de um jid. Null para grupos (@g.us). */
function jidToPhone(jid?: string): string | null {
  if (!jid || jid.includes('@g.us')) return null;
  const phone = jid.split('@')[0]?.replace(/\D/g, '');
  return phone || null;
}

/**
 * Alvo de resposta. O WhatsApp moderno mascara o remetente com um LID
 * (`<id>@lid`) em vez do telefone — para responder precisamos mandar de volta
 * para o **jid original**, não para um número reconstruído. Em @lid devolvemos o
 * jid completo (a Evolution v2.3.7+ aceita enviar para @lid); em @s.whatsapp.net
 * basta o número.
 */
function replyTarget(remoteJid: string, phone: string): string {
  return remoteJid.includes('@lid') ? remoteJid : phone;
}

function extractText(message: unknown): string | null {
  const m = message as {
    conversation?: string;
    extendedTextMessage?: { text?: string };
    imageMessage?: { caption?: string };
  };
  return m?.conversation ?? m?.extendedTextMessage?.text ?? m?.imageMessage?.caption ?? null;
}

interface EvoMessage {
  key?: { remoteJid?: string; fromMe?: boolean; id?: string };
  message?: unknown;
  pushName?: string;
  status?: string;
}

export const webhookReceiverService = {
  /** Processa um evento da Evolution para a instância identificada por `key`. */
  async handle(key: string, rawEvent: string, data: unknown): Promise<void> {
    const inst = await repo.findInstanceByKey(key);
    if (!inst) {
      logger.warn({ key, rawEvent }, 'Webhook para instância desconhecida — ignorado');
      return;
    }
    const event = rawEvent.toLowerCase().replace(/[-_]/g, '.');

    switch (event) {
      case 'connection.update': {
        const d = data as { state?: string; instance?: { state?: string } };
        const status = mapState(d?.state ?? d?.instance?.state);
        await repo.updateInstanceStatus(inst.id, status);
        emitToTenant(inst.tenantId, 'instance:status', { id: inst.id, status });
        break;
      }
      case 'qrcode.updated': {
        const d = data as { qrcode?: { base64?: string }; base64?: string };
        const b64 = d?.qrcode?.base64 ?? d?.base64;
        if (b64) {
          await repo.updateInstanceQr(inst.id, b64);
          emitToTenant(inst.tenantId, 'instance:status', {
            id: inst.id,
            status: 'QR_PENDING',
            qrCode: b64,
          });
        }
        break;
      }
      case 'messages.upsert': {
        const msgs = this.normalizeMessages(data);
        for (const msg of msgs) {
          await this.ingestInbound(inst, msg);
        }
        break;
      }
      case 'messages.update': {
        const updates = this.normalizeMessages(data);
        for (const u of updates) {
          if (u.key?.id && u.status) {
            await repo.updateMessageStatusByExternalId(u.key.id, u.status);
          }
        }
        break;
      }
      default:
        logger.debug({ event }, 'Evento de webhook ignorado');
    }
  },

  normalizeMessages(data: unknown): EvoMessage[] {
    const d = data as { messages?: EvoMessage[] } | EvoMessage[] | EvoMessage;
    if (Array.isArray(d)) return d;
    if (d && typeof d === 'object' && 'messages' in d && Array.isArray(d.messages)) {
      return d.messages;
    }
    return [d as EvoMessage];
  },

  async ingestInbound(inst: Instance, msg: EvoMessage): Promise<void> {
    if (!msg?.key || msg.key.fromMe) return; // só mensagens recebidas
    const jid = msg.key.remoteJid;
    const phone = jidToPhone(jid);
    if (!jid || !phone) return; // ignora grupos / jids inválidos

    const contactId = await repo.upsertContact(inst.tenantId, phone, msg.pushName);
    const conversation = await repo.findOrCreateConversation(inst.tenantId, inst.id, contactId);
    const content = extractText(msg.message);
    await repo.createInboundMessage({
      conversationId: conversation.id,
      externalId: msg.key.id,
      content,
    });
    await repo.touchConversation(conversation.id, content ?? '[mídia]');
    emitToTenant(inst.tenantId, 'message:new', {
      conversationId: conversation.id,
      contactId,
      preview: content ?? '[mídia]',
    });
    logger.info({ instanceId: inst.id, phone }, 'Mensagem recebida persistida');

    // Webhooks de saída (T-047): dispara `MESSAGE_RECEIVED` para integrações
    // externas. Best-effort: dispatchEvent só enfileira (não faz POST) e nunca
    // propaga erro, então não interfere no fluxo de ingestão/bot.
    void webhooksService
      .dispatchEvent(inst.tenantId, 'MESSAGE_RECEIVED', {
        conversationId: conversation.id,
        contactId,
        phone,
        text: content,
        externalId: msg.key.id,
      })
      .catch(err =>
        logger.warn({ err, instanceId: inst.id }, 'Falha ao despachar webhook MESSAGE_RECEIVED'),
      );

    // Bot: roda o motor de fluxos (best-effort) sobre a mensagem recebida.
    await flowRunner.runBot({
      tenantId: inst.tenantId,
      instanceId: inst.id,
      evolutionKey: inst.evolutionKey,
      conversationId: conversation.id,
      botActive: conversation.botActive,
      replyTo: replyTarget(jid, phone),
      contactPhone: phone,
      text: content ?? '',
    });
  },
};
