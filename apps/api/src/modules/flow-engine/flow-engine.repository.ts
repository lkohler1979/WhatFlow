import { prisma } from '@core/prisma.js';
import type { FlowSession, Prisma } from '@prisma/client';

/** Persistência de sessões de fluxo + mensagens de saída do bot. */
export const flowEngineRepository = {
  /** Sessão ativa (não concluída/falha) da conversa. */
  findActiveSession(conversationId: string): Promise<FlowSession | null> {
    return prisma.flowSession.findFirst({
      where: { conversationId, completedAt: null, failedAt: null },
      orderBy: { startedAt: 'desc' },
    });
  },

  createSession(input: {
    flowId: string;
    conversationId: string;
    currentNodeId: string;
    variables: Prisma.InputJsonValue;
    waitingForInput: boolean;
    completed: boolean;
  }): Promise<FlowSession> {
    return prisma.flowSession.create({
      data: {
        flowId: input.flowId,
        conversationId: input.conversationId,
        currentNodeId: input.currentNodeId,
        variables: input.variables,
        waitingForInput: input.waitingForInput,
        completedAt: input.completed ? new Date() : null,
      },
    });
  },

  async updateSession(
    id: string,
    data: {
      currentNodeId: string;
      variables: Prisma.InputJsonValue;
      waitingForInput: boolean;
      completed: boolean;
    },
  ): Promise<void> {
    await prisma.flowSession.update({
      where: { id },
      data: {
        currentNodeId: data.currentNodeId,
        variables: data.variables,
        waitingForInput: data.waitingForInput,
        completedAt: data.completed ? new Date() : null,
      },
    });
  },

  createOutboundMessage(conversationId: string, content: string): Promise<{ id: string }> {
    return prisma.message.create({
      data: {
        conversationId,
        direction: 'OUTBOUND',
        type: 'TEXT',
        content,
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

  async setBotActive(conversationId: string, active: boolean): Promise<void> {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { botActive: active },
    });
  },
};
