import { prisma } from '@core/prisma.js';
import type { Conversation, ConversationStatus, Contact, Prisma } from '@prisma/client';

/** Tags incluídas na conversa (T-040) — para exibição no inbox. */
const conversationTagsInclude = {
  conversationTags: { include: { tag: true } },
} satisfies Prisma.ConversationInclude;

/** Conversa com os dados de contato + tags necessários ao inbox. */
export type ConversationWithContact = Conversation & {
  contact: Pick<Contact, 'id' | 'name' | 'phone' | 'avatarUrl'>;
  conversationTags: { tag: { id: string; name: string; color: string } }[];
};

interface ListFilters {
  status?: ConversationStatus;
  instanceId?: string;
  assignedToUserId?: string;
  contactId?: string;
  tagId?: string;
  botActive?: boolean;
  search?: string;
  page: number;
  pageSize: number;
}

/** Acesso a dados de conversas — sempre escopado por tenant (Prisma bypassa RLS). */
export const conversationsRepository = {
  async listByTenant(
    tenantId: string,
    f: ListFilters,
  ): Promise<{ data: ConversationWithContact[]; total: number }> {
    const where: Prisma.ConversationWhereInput = { tenantId };
    if (f.status) where.status = f.status;
    if (f.instanceId) where.instanceId = f.instanceId;
    if (f.assignedToUserId) where.assignedTo = f.assignedToUserId;
    if (f.contactId) where.contactId = f.contactId;
    if (f.tagId) where.conversationTags = { some: { tagId: f.tagId } };
    if (f.botActive !== undefined) where.botActive = f.botActive;
    if (f.search) {
      where.contact = {
        OR: [
          { name: { contains: f.search, mode: 'insensitive' } },
          { phone: { contains: f.search, mode: 'insensitive' } },
        ],
      };
    }

    const contactSelect = { id: true, name: true, phone: true, avatarUrl: true } as const;
    const [data, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        include: { contact: { select: contactSelect }, ...conversationTagsInclude },
        // lastMessageAt pode ser null em conversas recém-criadas → empurra p/ o fim.
        orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
        skip: (f.page - 1) * f.pageSize,
        take: f.pageSize,
      }),
      prisma.conversation.count({ where }),
    ]);
    return { data: data as ConversationWithContact[], total };
  },

  findByIdInTenant(id: string, tenantId: string): Promise<ConversationWithContact | null> {
    return prisma.conversation.findFirst({
      where: { id, tenantId },
      include: {
        contact: { select: { id: true, name: true, phone: true, avatarUrl: true } },
        ...conversationTagsInclude,
      },
    }) as Promise<ConversationWithContact | null>;
  },

  /** Confere que um usuário (interno) pertence ao tenant — para atribuição. */
  async userBelongsToTenant(userId: string, tenantId: string): Promise<boolean> {
    const count = await prisma.user.count({ where: { id: userId, tenantId } });
    return count > 0;
  },

  /** Atualização parcial escopada por tenant. Retorna nº de linhas afetadas. */
  async update(
    id: string,
    tenantId: string,
    data: Prisma.ConversationUpdateInput,
  ): Promise<number> {
    const res = await prisma.conversation.updateMany({ where: { id, tenantId }, data });
    return res.count;
  },

  /** Zera o contador de não lidas (marca como lida). */
  async markRead(id: string, tenantId: string): Promise<number> {
    const res = await prisma.conversation.updateMany({
      where: { id, tenantId },
      data: { unreadCount: 0 },
    });
    return res.count;
  },
};
