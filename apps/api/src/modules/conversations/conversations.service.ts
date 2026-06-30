import { conversationsRepository } from './conversations.repository.js';
import type { ConversationWithContact } from './conversations.repository.js';
import { AppError, NotFoundError } from '@core/errors.js';
import { emitToTenant } from '@core/realtime.js';
import type { ListConversationsQuery, UpdateConversationDto } from './conversations.schema.js';
import type { ConversationStatus, Prisma } from '@prisma/client';

interface ConversationDto {
  id: string;
  instanceId: string;
  status: ConversationStatus;
  botActive: boolean;
  assignedToUserId: string | null;
  unreadCount: number;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  createdAt: Date;
  updatedAt: Date;
  contact: { id: string; name: string | null; phone: string; avatarUrl: string | null };
}

function toDto(c: ConversationWithContact): ConversationDto {
  return {
    id: c.id,
    instanceId: c.instanceId,
    status: c.status,
    botActive: c.botActive,
    assignedToUserId: c.assignedTo,
    unreadCount: c.unreadCount,
    lastMessageAt: c.lastMessageAt,
    lastMessagePreview: c.lastMessagePreview,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    contact: {
      id: c.contact.id,
      name: c.contact.name,
      phone: c.contact.phone,
      avatarUrl: c.contact.avatarUrl,
    },
  };
}

export const conversationsService = {
  async list(
    tenantId: string,
    query: ListConversationsQuery,
  ): Promise<{ data: ConversationDto[]; total: number; page: number; pageSize: number }> {
    const { data, total } = await conversationsRepository.listByTenant(tenantId, {
      status: query.status,
      instanceId: query.instanceId,
      assignedToUserId: query.assignedToUserId,
      contactId: query.contactId,
      botActive: query.botActive,
      search: query.search,
      page: query.page,
      pageSize: query.pageSize,
    });
    return { data: data.map(toDto), total, page: query.page, pageSize: query.pageSize };
  },

  async get(tenantId: string, id: string): Promise<ConversationDto> {
    const conv = await conversationsRepository.findByIdInTenant(id, tenantId);
    if (!conv) throw new NotFoundError('Conversa');
    return toDto(conv);
  },

  /** Atualiza status / atribuição / bot. Valida que o agente pertence ao tenant. */
  async update(tenantId: string, id: string, dto: UpdateConversationDto): Promise<ConversationDto> {
    // Garante existência no tenant antes de atualizar.
    await this.get(tenantId, id);

    const data: Prisma.ConversationUpdateInput = {};
    if (dto.status !== undefined) {
      data.status = dto.status;
      // RESOLVED registra o momento da resolução; demais estados limpam.
      data.resolvedAt = dto.status === 'RESOLVED' ? new Date() : null;
    }
    if (dto.botActive !== undefined) data.botActive = dto.botActive;
    if (dto.assignedToUserId !== undefined) {
      if (dto.assignedToUserId === null) {
        data.assignedUser = { disconnect: true };
      } else {
        const ok = await conversationsRepository.userBelongsToTenant(
          dto.assignedToUserId,
          tenantId,
        );
        if (!ok) throw new AppError('Usuário não pertence ao tenant', 422, 'INVALID_ASSIGNEE');
        data.assignedUser = { connect: { id: dto.assignedToUserId } };
      }
    }

    await conversationsRepository.update(id, tenantId, data);
    const updated = await this.get(tenantId, id);
    emitToTenant(tenantId, 'conversation:updated', updated);
    return updated;
  },

  /** Marca a conversa como lida (zera unreadCount). */
  async markRead(tenantId: string, id: string): Promise<ConversationDto> {
    await this.get(tenantId, id);
    await conversationsRepository.markRead(id, tenantId);
    const updated = await this.get(tenantId, id);
    emitToTenant(tenantId, 'conversation:read', { id, unreadCount: 0 });
    return updated;
  },
};
