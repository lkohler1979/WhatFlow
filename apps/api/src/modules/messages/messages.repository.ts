import { prisma } from '@core/prisma.js';
import type { Message } from '@prisma/client';

/** Dados da conversa necessários para o agente enviar uma mensagem. */
export interface ConversationSendContext {
  id: string;
  instanceEvolutionKey: string;
  instanceStatus: string;
  contactPhone: string;
}

/** Acesso a dados de mensagens — sempre escopado por tenant (via conversa). */
export const messagesRepository = {
  /** Confere que a conversa pertence ao tenant. */
  async conversationBelongsToTenant(conversationId: string, tenantId: string): Promise<boolean> {
    const count = await prisma.conversation.count({
      where: { id: conversationId, tenantId },
    });
    return count > 0;
  },

  /**
   * Histórico cronológico (asc) da conversa, paginado por cursor.
   * Quando `cursor` é informado, retorna as mensagens APÓS aquela mensagem.
   * Busca `limit + 1` para saber se há próxima página.
   */
  listByConversation(
    conversationId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<Message[]> {
    return prisma.message.findMany({
      where: { conversationId },
      orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
      take: opts.limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });
  },

  /** Resolve evolutionKey da instância + telefone do contato da conversa (tenant-scoped). */
  async getSendContext(
    conversationId: string,
    tenantId: string,
  ): Promise<ConversationSendContext | null> {
    const conv = await prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      select: {
        id: true,
        instance: { select: { evolutionKey: true, status: true } },
        contact: { select: { phone: true } },
      },
    });
    if (!conv) return null;
    return {
      id: conv.id,
      instanceEvolutionKey: conv.instance.evolutionKey,
      instanceStatus: conv.instance.status,
      contactPhone: conv.contact.phone,
    };
  },

  /** Mapeia o supabaseUid do JWT → id interno do User no tenant (para sentByAgentId). */
  async findUserIdBySupabaseUid(supabaseUid: string, tenantId: string): Promise<string | null> {
    const user = await prisma.user.findFirst({
      where: { supabaseUid, tenantId },
      select: { id: true },
    });
    return user?.id ?? null;
  },

  createOutboundMessage(input: {
    conversationId: string;
    sentByAgentId?: string | null;
    externalId?: string | null;
    content: string;
  }): Promise<Message> {
    return prisma.message.create({
      data: {
        conversationId: input.conversationId,
        sentByAgentId: input.sentByAgentId ?? undefined,
        externalId: input.externalId ?? undefined,
        direction: 'OUTBOUND',
        type: 'TEXT',
        content: input.content,
        status: 'SENT',
        timestamp: new Date(),
      },
    });
  },

  /** Atualiza preview/último-envio da conversa (agente enviando não incrementa unread). */
  async touchConversation(id: string, preview: string): Promise<void> {
    await prisma.conversation.update({
      where: { id },
      data: { lastMessageAt: new Date(), lastMessagePreview: preview.slice(0, 200) },
    });
  },
};
