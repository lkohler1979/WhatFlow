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

export type CreateInstanceDto = z.infer<typeof CreateInstanceSchema>;
export type UpdateInstanceDto = z.infer<typeof UpdateInstanceSchema>;
