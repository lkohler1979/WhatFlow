import { messagesRepository } from './messages.repository.js';
import { evolutionApiService } from '@integrations/evolution-api/evolution-api.service.js';
import { AppError, NotFoundError } from '@core/errors.js';
import { emitToTenant } from '@core/realtime.js';
import type { Message } from '@prisma/client';
import type { ListMessagesQuery, SendMessageDto } from './messages.schema.js';

interface MessageDto {
  id: string;
  direction: Message['direction'];
  type: Message['type'];
  content: string | null;
  mediaUrl: string | null;
  status: Message['status'];
  externalId: string | null;
  isInternal: boolean;
  sentByAgentId: string | null;
  timestamp: Date;
}

function toDto(m: Message): MessageDto {
  return {
    id: m.id,
    direction: m.direction,
    type: m.type,
    content: m.content,
    mediaUrl: m.mediaUrl,
    status: m.status,
    externalId: m.externalId,
    isInternal: m.isInternal,
    sentByAgentId: m.sentByAgentId,
    timestamp: m.timestamp,
  };
}

export const messagesService = {
  /**
   * Histórico paginado (cursor-based). Retorna mensagens em ordem cronológica
   * asc e o `nextCursor` (id da última msg) quando há mais páginas.
   */
  async list(
    tenantId: string,
    conversationId: string,
    query: ListMessagesQuery,
  ): Promise<{ data: MessageDto[]; nextCursor: string | null }> {
    const belongs = await messagesRepository.conversationBelongsToTenant(conversationId, tenantId);
    if (!belongs) throw new NotFoundError('Conversa');

    const rows = await messagesRepository.listByConversation(conversationId, {
      cursor: query.cursor,
      limit: query.limit,
    });

    // Pegamos limit+1 para detectar próxima página sem um count extra.
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    return { data: page.map(toDto), nextCursor };
  },

  /**
   * Agente envia uma mensagem de texto: resolve a instância/contato da conversa,
   * envia via Evolution, persiste OUTBOUND (SENT) e emite o evento de realtime.
   */
  async send(
    tenantId: string,
    conversationId: string,
    dto: SendMessageDto,
    supabaseUid?: string,
  ): Promise<MessageDto> {
    const ctx = await messagesRepository.getSendContext(conversationId, tenantId);
    if (!ctx) throw new NotFoundError('Conversa');
    if (ctx.instanceStatus !== 'CONNECTED') {
      throw new AppError('Instância não está conectada', 409, 'INSTANCE_NOT_CONNECTED');
    }

    const result = await evolutionApiService.sendText(ctx.instanceEvolutionKey, {
      number: ctx.contactPhone,
      text: dto.text,
    });
    const externalId = (result as { key?: { id?: string } })?.key?.id ?? null;

    const sentByAgentId = supabaseUid
      ? await messagesRepository.findUserIdBySupabaseUid(supabaseUid, tenantId)
      : null;

    const msg = await messagesRepository.createOutboundMessage({
      conversationId,
      sentByAgentId,
      externalId,
      content: dto.text,
    });
    await messagesRepository.touchConversation(conversationId, dto.text);

    const dtoOut = toDto(msg);
    emitToTenant(tenantId, 'message:new', { conversationId, message: dtoOut });
    return dtoOut;
  },
};
