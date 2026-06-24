import { z } from 'zod';

const campaignBaseShape = z.object({
  name: z.string().min(2).max(200),
  instanceId: z.string().uuid(),
  messageType: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT']),
  messageContent: z.string().optional(),
  mediaUrl: z.string().url().optional(),
  scheduledAt: z.coerce.date().optional(),
  delayMinMs: z.number().min(1000).max(30000).default(3000),
  delayMaxMs: z.number().min(1000).max(60000).default(8000),
});

export const CreateCampaignSchema = campaignBaseShape.refine(
  d => d.messageType !== 'TEXT' || !!d.messageContent,
  { message: 'messageContent é obrigatório para tipo TEXT', path: ['messageContent'] },
);

export const UpdateCampaignSchema = campaignBaseShape.partial();

export type CreateCampaignDto = z.infer<typeof CreateCampaignSchema>;
export type UpdateCampaignDto = z.infer<typeof UpdateCampaignSchema>;
