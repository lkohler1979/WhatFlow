import { z } from 'zod';

/** Cor em hex (#RGB ou #RRGGBB). Default alinhado ao schema.prisma (#3498DB). */
const HexColorSchema = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Cor inválida (use hex, ex.: #3498DB)');

export const CreateTagSchema = z.object({
  name: z.string().trim().min(1, 'Nome obrigatório').max(50),
  color: HexColorSchema.optional().default('#3498DB'),
});

export const UpdateTagSchema = z
  .object({
    name: z.string().trim().min(1).max(50).optional(),
    color: HexColorSchema.optional(),
  })
  .refine(d => d.name !== undefined || d.color !== undefined, {
    message: 'Informe ao menos um campo para atualizar (name ou color)',
  });

export const ListTagsQuerySchema = z.object({
  /** Filtro por prefixo do nome — alimenta o autocomplete. */
  q: z.string().trim().max(50).optional(),
});

export const TagIdParamSchema = z.object({
  id: z.string().uuid('ID inválido'),
});

/** Body para anexar uma tag a um contato. */
export const AttachTagSchema = z.object({
  tagId: z.string().uuid('tagId inválido'),
});

/** Params de attach/detach em contato: /contacts/:id/tags(/:tagId). */
export const ContactTagParamsSchema = z.object({
  id: z.string().uuid('ID do contato inválido'),
  tagId: z.string().uuid('tagId inválido'),
});

/** Params de attach/detach em conversa: /conversations/:id/tags(/:tagId). */
export const ConversationTagParamsSchema = z.object({
  id: z.string().uuid('ID da conversa inválido'),
  tagId: z.string().uuid('tagId inválido'),
});

export type CreateTagDto = z.infer<typeof CreateTagSchema>;
export type UpdateTagDto = z.infer<typeof UpdateTagSchema>;
export type ListTagsQuery = z.infer<typeof ListTagsQuerySchema>;
export type AttachTagDto = z.infer<typeof AttachTagSchema>;
