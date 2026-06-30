import { z } from 'zod';

/** Status de conversa que podem ser definidos via PATCH (enum ConversationStatus). */
const ConversationStatusEnum = z.enum(['OPEN', 'PENDING', 'RESOLVED', 'SPAM']);

/** Filtro + paginação na listagem de conversas. */
export const ListConversationsQuerySchema = z.object({
  status: ConversationStatusEnum.optional(),
  instanceId: z.string().uuid().optional(),
  assignedToUserId: z.string().uuid().optional(),
  /** Filtra por bot ligado/desligado. Aceita "true"/"false" em querystring. */
  botActive: z
    .enum(['true', 'false'])
    .transform(v => v === 'true')
    .optional(),
  /** Busca por nome ou telefone do contato (case-insensitive, substring). */
  search: z.string().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Atualização da conversa: status, atribuição e (opcionalmente) bot on/off.
 * `assignedToUserId` aceita `null` explícito para desatribuir.
 */
export const UpdateConversationSchema = z
  .object({
    status: ConversationStatusEnum.optional(),
    assignedToUserId: z.string().uuid().nullable().optional(),
    botActive: z.boolean().optional(),
  })
  .refine(
    d => d.status !== undefined || d.assignedToUserId !== undefined || d.botActive !== undefined,
    { message: 'Informe ao menos um campo para atualizar' },
  );

export type ListConversationsQuery = z.infer<typeof ListConversationsQuerySchema>;
export type UpdateConversationDto = z.infer<typeof UpdateConversationSchema>;
