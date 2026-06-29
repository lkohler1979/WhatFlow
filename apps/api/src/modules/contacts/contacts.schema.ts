import { z } from 'zod';

export function normalizePhone(value: string): string {
  return value.replace(/\D/g, '');
}

export function isValidPhone(value: string): boolean {
  return /^[1-9]\d{7,14}$/.test(value);
}

const PhoneSchema = z
  .string()
  .min(8)
  .max(32)
  .transform(normalizePhone)
  .refine(isValidPhone, 'Telefone inválido (8 a 15 dígitos, com DDI)');

const CustomFieldsSchema = z.record(z.unknown()).default({});

export const CreateContactSchema = z.object({
  phone: PhoneSchema,
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  customFields: CustomFieldsSchema,
  isBlocked: z.boolean().optional().default(false),
  isOptedOut: z.boolean().optional().default(false),
  tagIds: z.array(z.string().uuid()).optional().default([]),
});

export const UpdateContactSchema = z.object({
  phone: PhoneSchema.optional(),
  name: z.string().min(1).max(200).nullable().optional(),
  email: z.string().email().nullable().optional(),
  customFields: z.record(z.unknown()).optional(),
  isBlocked: z.boolean().optional(),
  isOptedOut: z.boolean().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
});

export const ContactIdParamSchema = z.object({
  id: z.string().uuid('ID inválido'),
});

export const ListContactsQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  tagId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const ImportContactsSchema = z.object({
  csv: z.string().min(1, 'CSV vazio').max(5_000_000, 'CSV muito grande'),
});

export type CreateContactDto = z.infer<typeof CreateContactSchema>;
export type UpdateContactDto = z.infer<typeof UpdateContactSchema>;
export type ListContactsQuery = z.infer<typeof ListContactsQuerySchema>;
export type ImportContactsDto = z.infer<typeof ImportContactsSchema>;
