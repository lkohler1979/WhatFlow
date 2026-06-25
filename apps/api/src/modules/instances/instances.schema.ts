import { z } from 'zod';

export const CreateInstanceSchema = z.object({
  name: z.string().min(2).max(100),
  settings: z
    .object({
      sendDelayMinMs: z.number().min(1000).default(3000),
      sendDelayMaxMs: z.number().min(1000).default(8000),
      autoRead: z.boolean().default(false),
    })
    .optional()
    .default({}),
});

export const UpdateInstanceSchema = CreateInstanceSchema.partial();

export const SendMessageSchema = z.object({
  number: z
    .string()
    .regex(/^\d{8,15}$/, 'Número deve ter só dígitos com DDI/DDD (ex.: 5527999887766)'),
  text: z.string().min(1).max(4096),
});

export type CreateInstanceDto = z.infer<typeof CreateInstanceSchema>;
export type UpdateInstanceDto = z.infer<typeof UpdateInstanceSchema>;
export type SendMessageDto = z.infer<typeof SendMessageSchema>;
