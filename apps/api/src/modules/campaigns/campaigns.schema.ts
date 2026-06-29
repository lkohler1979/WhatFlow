import { z } from 'zod';

/**
 * Tipos de mensagem suportados pela campanha (subconjunto do enum MessageType
 * do Prisma que faz sentido para disparo em massa).
 */
const CampaignMessageType = z.enum(['TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT']);

const campaignBaseShape = z.object({
  name: z.string().min(2).max(200),
  description: z.string().max(500).optional(),
  instanceId: z.string().uuid(),
  messageType: CampaignMessageType.default('TEXT'),
  messageContent: z.string().max(4096).optional(),
  mediaUrl: z.string().url().max(500).optional(),
  mediaCaption: z.string().max(500).optional(),
  scheduledAt: z.coerce.date().optional(),
  delayMinMs: z.number().int().min(1000).max(600_000).default(3000),
  delayMaxMs: z.number().int().min(1000).max(600_000).default(8000),
});

export const CreateCampaignSchema = campaignBaseShape
  .extend({
    /** UUIDs de Contacts do tenant que entram na campanha. */
    contactIds: z.array(z.string().uuid()).min(1).max(50_000),
  })
  .refine(d => d.messageType !== 'TEXT' || !!d.messageContent, {
    message: 'messageContent é obrigatório para mensagens de texto',
    path: ['messageContent'],
  })
  .refine(d => d.messageType === 'TEXT' || !!d.mediaUrl, {
    message: 'mediaUrl é obrigatório para mensagens de mídia',
    path: ['mediaUrl'],
  })
  .refine(d => d.delayMinMs <= d.delayMaxMs, {
    message: 'delayMinMs não pode ser maior que delayMaxMs',
    path: ['delayMinMs'],
  });

/**
 * Update só permitido em campanhas editáveis (DRAFT/SCHEDULED) e não altera a
 * lista de contatos. Todos os campos são opcionais.
 */
export const UpdateCampaignSchema = campaignBaseShape
  .partial()
  .refine(
    d => d.delayMinMs === undefined || d.delayMaxMs === undefined || d.delayMinMs <= d.delayMaxMs,
    { message: 'delayMinMs não pode ser maior que delayMaxMs', path: ['delayMinMs'] },
  );

/** Filtro/paginação na listagem. */
export const ListCampaignsQuerySchema = z.object({
  status: z
    .enum(['DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED', 'FAILED'])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateCampaignDto = z.infer<typeof CreateCampaignSchema>;
export type UpdateCampaignDto = z.infer<typeof UpdateCampaignSchema>;
export type ListCampaignsQuery = z.infer<typeof ListCampaignsQuerySchema>;
