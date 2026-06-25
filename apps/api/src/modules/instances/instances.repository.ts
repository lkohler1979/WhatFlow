import { prisma } from '@core/prisma.js';
import type { Instance, Prisma } from '@prisma/client';

/** Acesso a dados de instâncias — sempre escopado por tenant. */
export const instancesRepository = {
  listByTenant(tenantId: string): Promise<Instance[]> {
    return prisma.instance.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
  },

  findByIdInTenant(id: string, tenantId: string): Promise<Instance | null> {
    return prisma.instance.findFirst({ where: { id, tenantId } });
  },

  create(data: Prisma.InstanceUncheckedCreateInput): Promise<Instance> {
    return prisma.instance.create({ data });
  },

  async update(id: string, tenantId: string, data: Prisma.InstanceUpdateInput): Promise<number> {
    const res = await prisma.instance.updateMany({ where: { id, tenantId }, data });
    return res.count;
  },

  async remove(id: string, tenantId: string): Promise<number> {
    const res = await prisma.instance.deleteMany({ where: { id, tenantId } });
    return res.count;
  },

  // ── Persistência de mensagens (envio manual) ──
  async upsertContact(tenantId: string, phone: string): Promise<string> {
    const contact = await prisma.contact.upsert({
      where: { tenantId_phone: { tenantId, phone } },
      update: {},
      create: { tenantId, phone },
    });
    return contact.id;
  },

  async findOrCreateConversationId(
    tenantId: string,
    instanceId: string,
    contactId: string,
  ): Promise<string> {
    const existing = await prisma.conversation.findFirst({
      where: { tenantId, instanceId, contactId },
      select: { id: true },
    });
    if (existing) return existing.id;
    const created = await prisma.conversation.create({
      data: { tenantId, instanceId, contactId },
      select: { id: true },
    });
    return created.id;
  },

  createOutboundMessage(input: {
    conversationId: string;
    sentByAgentId?: string;
    externalId?: string;
    content: string;
  }): Promise<{ id: string }> {
    return prisma.message.create({
      data: {
        conversationId: input.conversationId,
        sentByAgentId: input.sentByAgentId,
        externalId: input.externalId,
        direction: 'OUTBOUND',
        type: 'TEXT',
        content: input.content,
        status: 'SENT',
        timestamp: new Date(),
      },
      select: { id: true },
    });
  },

  async touchConversation(id: string, preview: string): Promise<void> {
    await prisma.conversation.update({
      where: { id },
      data: { lastMessageAt: new Date(), lastMessagePreview: preview.slice(0, 200) },
    });
  },
};
