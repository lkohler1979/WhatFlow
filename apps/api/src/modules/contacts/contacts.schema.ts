import { z } from 'zod';

export const CreateContactSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{7,14}$/, 'Telefone inválido (formato E.164)'),
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  customFields: z.record(z.unknown()).optional().default({}),
  tagIds: z.array(z.string().uuid()).optional().default([]),
});

export const UpdateContactSchema = CreateContactSchema.partial();

export type CreateContactDto = z.infer<typeof CreateContactSchema>;
export type UpdateContactDto = z.infer<typeof UpdateContactSchema>;
