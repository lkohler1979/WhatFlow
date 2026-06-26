import { logger } from '@core/logger.js';
import { emitToTenant } from '@core/realtime.js';
import { webhookReceiverRepository as repo } from './webhook-receiver.repository.js';
import { flowRunner } from '@modules/flow-engine/flow-engine.runner.js';
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

/**
 * "5527999@s.whatsapp.net" → "5527999". Ignora grupos (@g.us) e LIDs (@lid):
 * o @lid é um identificador de privacidade do WhatsApp, NÃO um telefone real —
 * nesses casos o número verdadeiro vem do `sender` do envelope do webhook.
 */
function jidToPhone(jid?: string): string | null {
  if (!jid || jid.includes('@g.us') || jid.includes('@lid')) return null;
  const phone = jid.split('@')[0]?.replace(/\D/g, '');
  return phone || null;
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
  async handle(
    key: string,
    rawEvent: string,
    data: unknown,
    envelopeSender?: string,
  ): Promise<void> {
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
          await this.ingestInbound(inst, msg, envelopeSender);
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

  async ingestInbound(inst: Instance, msg: EvoMessage, envelopeSender?: string): Promise<void> {
    if (!msg?.key || msg.key.fromMe) return; // só mensagens recebidas
    if (msg.key.remoteJid?.includes('@g.us')) return; // ignora grupos
    // Telefone real: do remoteJid quando for @s.whatsapp.net; senão (ex.: @lid)
    // cai para o `sender` do envelope, que a Evolution preenche com o número real.
    const phone = jidToPhone(msg.key.remoteJid) ?? jidToPhone(envelopeSender);
    if (!phone) return;

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

    // Bot: roda o motor de fluxos (best-effort) sobre a mensagem recebida.
    await flowRunner.runBot({
      tenantId: inst.tenantId,
      instanceId: inst.id,
      evolutionKey: inst.evolutionKey,
      conversationId: conversation.id,
      botActive: conversation.botActive,
      contactPhone: phone,
      text: content ?? '',
    });
  },
};
