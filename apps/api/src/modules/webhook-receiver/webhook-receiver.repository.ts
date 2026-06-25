import { prisma } from '@core/prisma.js';
import type { Instance, InstanceStatus, Conversation, Message } from '@prisma/client';

/** Acesso a dados do receiver de webhooks (resolve tenant via a instância). */
export const webhookReceiverRepository = {
  findInstanceByKey(evolutionKey: string): Promise<Instance | null> {
    return prisma.instance.findFirst({ where: { evolutionKey } });
  },

  async updateInstanceStatus(
    id: string,
    status: InstanceStatus,
    extra: { phone?: string } = {},
  ): Promise<void> {
    await prisma.instance.update({
      where: { id },
      data: {
        status,
        ...(extra.phone ? { phone: extra.phone } : {}),
        ...(status === 'CONNECTED' ? { connectedAt: new Date(), qrCode: null } : {}),
        ...(status === 'DISCONNECTED' ? { disconnectedAt: new Date() } : {}),
      },
    });
  },

  async updateInstanceQr(id: string, qrCode: string): Promise<void> {
    await prisma.instance.update({
      where: { id },
      data: { qrCode, status: 'QR_PENDING', qrExpiresAt: new Date(Date.now() + 60_000) },
    });
  },

  async upsertContact(tenantId: string, phone: string, name?: string): Promise<string> {
    const contact = await prisma.contact.upsert({
      where: { tenantId_phone: { tenantId, phone } },
      update: { lastSeenAt: new Date(), ...(name ? { name } : {}) },
      create: { tenantId, phone, name, lastSeenAt: new Date() },
    });
    return contact.id;
  },

  async findOrCreateConversation(
    tenantId: string,
    instanceId: string,
    contactId: string,
  ): Promise<Conversation> {
    const existing = await prisma.conversation.findFirst({
      where: { tenantId, instanceId, contactId },
    });
    if (existing) return existing;
    return prisma.conversation.create({ data: { tenantId, instanceId, contactId } });
  },

  createInboundMessage(input: {
    conversationId: string;
    externalId?: string;
    content: string | null;
  }): Promise<Message> {
    return prisma.message.create({
      data: {
        conversationId: input.conversationId,
        externalId: input.externalId,
        direction: 'INBOUND',
        type: 'TEXT',
        content: input.content,
        status: 'DELIVERED',
        timestamp: new Date(),
      },
    });
  },

  async touchConversation(id: string, preview: string): Promise<void> {
    await prisma.conversation.update({
      where: { id },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: preview.slice(0, 200),
        unreadCount: { increment: 1 },
      },
    });
  },

  async updateMessageStatusByExternalId(externalId: string, status: string): Promise<void> {
    const map: Record<string, 'SENT' | 'DELIVERED' | 'READ'> = {
      SERVER_ACK: 'SENT',
      DELIVERY_ACK: 'DELIVERED',
      READ: 'READ',
      PLAYED: 'READ',
    };
    const mapped = map[status];
    if (!mapped) return;
    await prisma.message.updateMany({ where: { externalId }, data: { status: mapped } });
  },
};
