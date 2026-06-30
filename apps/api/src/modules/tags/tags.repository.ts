import { prisma } from '@core/prisma.js';
import type { Prisma, Tag } from '@prisma/client';

/**
 * Acesso a dados de tags — sempre escopado por tenant (Prisma bypassa RLS, então
 * o tenantId entra explicitamente em toda query).
 */
export const tagsRepository = {
  /**
   * Lista tags do tenant; `q` filtra por prefixo (case-insensitive) do nome,
   * alimentando o autocomplete. Ordenado por nome.
   */
  listByTenant(tenantId: string, q?: string): Promise<Tag[]> {
    const where: Prisma.TagWhereInput = { tenantId };
    if (q) where.name = { startsWith: q, mode: 'insensitive' };
    return prisma.tag.findMany({ where, orderBy: { name: 'asc' } });
  },

  findByIdInTenant(id: string, tenantId: string): Promise<Tag | null> {
    return prisma.tag.findFirst({ where: { id, tenantId } });
  },

  findByNameInTenant(name: string, tenantId: string): Promise<Tag | null> {
    return prisma.tag.findFirst({
      where: { tenantId, name: { equals: name, mode: 'insensitive' } },
    });
  },

  create(data: Prisma.TagUncheckedCreateInput): Promise<Tag> {
    return prisma.tag.create({ data });
  },

  async update(id: string, tenantId: string, data: Prisma.TagUpdateInput): Promise<number> {
    const res = await prisma.tag.updateMany({ where: { id, tenantId }, data });
    return res.count;
  },

  async remove(id: string, tenantId: string): Promise<number> {
    // ContactTag/ConversationTag têm onDelete: Cascade no schema, então as
    // associações somem junto com a tag.
    const res = await prisma.tag.deleteMany({ where: { id, tenantId } });
    return res.count;
  },

  // ----------------------------------------------------------------
  // Aplicação a contatos (T-043). O contato é checado por tenant antes.
  // ----------------------------------------------------------------

  contactBelongsToTenant(contactId: string, tenantId: string): Promise<{ id: string } | null> {
    return prisma.contact.findFirst({ where: { id: contactId, tenantId }, select: { id: true } });
  },

  /** Anexa a tag ao contato (idempotente — ignora se já existir). */
  async attachToContact(contactId: string, tagId: string): Promise<void> {
    await prisma.contactTag.createMany({ data: [{ contactId, tagId }], skipDuplicates: true });
  },

  /** Remove a associação; retorna quantas linhas saíram (0 = não existia). */
  async detachFromContact(contactId: string, tagId: string): Promise<number> {
    const res = await prisma.contactTag.deleteMany({ where: { contactId, tagId } });
    return res.count;
  },

  // ----------------------------------------------------------------
  // Aplicação a conversas (T-040). Espelha o que existe para contatos.
  // A conversa é checada por tenant antes de anexar/remover.
  // ----------------------------------------------------------------

  conversationBelongsToTenant(
    conversationId: string,
    tenantId: string,
  ): Promise<{ id: string } | null> {
    return prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      select: { id: true },
    });
  },

  /** Anexa a tag à conversa (idempotente — ignora se já existir). */
  async attachToConversation(conversationId: string, tagId: string): Promise<void> {
    await prisma.conversationTag.createMany({
      data: [{ conversationId, tagId }],
      skipDuplicates: true,
    });
  },

  /** Remove a associação; retorna quantas linhas saíram (0 = não existia). */
  async detachFromConversation(conversationId: string, tagId: string): Promise<number> {
    const res = await prisma.conversationTag.deleteMany({ where: { conversationId, tagId } });
    return res.count;
  },
};
