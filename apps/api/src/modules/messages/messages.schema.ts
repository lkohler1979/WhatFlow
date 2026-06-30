import { z } from 'zod';

/**
 * Paginação cursor-based do histórico de mensagens.
 * O cursor é o id da última mensagem retornada na página anterior; a leitura
 * retorna mensagens em ordem cronológica estável (timestamp asc, id asc).
 */
export const ListMessagesQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

/** Envio de mensagem de texto pelo agente. */
export const SendMessageSchema = z.object({
  text: z.string().min(1).max(4096),
});

export type ListMessagesQuery = z.infer<typeof ListMessagesQuerySchema>;
export type SendMessageDto = z.infer<typeof SendMessageSchema>;
