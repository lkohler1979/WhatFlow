import { prisma } from '@core/prisma.js';
import type {
  Campaign,
  CampaignContact,
  CampaignContactStatus,
  CampaignStatus,
  Contact,
  Prisma,
} from '@prisma/client';

/** Acesso a dados de campanhas — sempre escopado por tenant (Prisma bypassa RLS). */
export const campaignsRepository = {
  async listByTenant(
    tenantId: string,
    opts: { status?: CampaignStatus; page: number; pageSize: number },
  ): Promise<{ data: Campaign[]; total: number }> {
    const where: Prisma.CampaignWhereInput = { tenantId };
    if (opts.status) where.status = opts.status;
    const [data, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (opts.page - 1) * opts.pageSize,
        take: opts.pageSize,
      }),
      prisma.campaign.count({ where }),
    ]);
    return { data, total };
  },

  findByIdInTenant(id: string, tenantId: string): Promise<Campaign | null> {
    return prisma.campaign.findFirst({ where: { id, tenantId } });
  },

  /** Confere que a instância pertence ao tenant (FK não tem coluna tenant). */
  async instanceBelongsToTenant(instanceId: string, tenantId: string): Promise<boolean> {
    const count = await prisma.instance.count({ where: { id: instanceId, tenantId } });
    return count > 0;
  },

  /** Contatos do tenant entre os IDs informados (snapshot de phone na campanha). */
  resolveContacts(
    tenantId: string,
    contactIds: string[],
  ): Promise<Pick<Contact, 'id' | 'phone'>[]> {
    return prisma.contact.findMany({
      where: { tenantId, id: { in: contactIds } },
      select: { id: true, phone: true },
    });
  },

  /**
   * Cria a campanha e associa seus contatos (CampaignContact) numa única
   * transação, já gravando totalContacts.
   */
  createWithContacts(
    data: Prisma.CampaignUncheckedCreateInput,
    contacts: { contactId: string; phone: string }[],
  ): Promise<Campaign> {
    return prisma.campaign.create({
      data: {
        ...data,
        totalContacts: contacts.length,
        contacts: {
          createMany: {
            data: contacts.map(c => ({ contactId: c.contactId, phone: c.phone })),
            skipDuplicates: true,
          },
        },
      },
    });
  },

  async update(id: string, tenantId: string, data: Prisma.CampaignUpdateInput): Promise<number> {
    const res = await prisma.campaign.updateMany({ where: { id, tenantId }, data });
    return res.count;
  },

  async updateStatus(
    id: string,
    tenantId: string,
    status: CampaignStatus,
    extra: Prisma.CampaignUpdateInput = {},
  ): Promise<number> {
    const res = await prisma.campaign.updateMany({
      where: { id, tenantId },
      data: { status, ...extra },
    });
    return res.count;
  },

  async remove(id: string, tenantId: string): Promise<number> {
    const res = await prisma.campaign.deleteMany({ where: { id, tenantId } });
    return res.count;
  },

  // ----------------------------------------------------------------
  // Suporte ao processor de disparo (T-033). O job traz tenantId, então
  // mantemos tenant-scope nas leituras/escritas da campanha.
  // ----------------------------------------------------------------

  /**
   * Carrega o `evolutionKey` da instância da campanha (tenant-scoped).
   * Retorna null se a campanha/instância não existir no tenant.
   */
  async getEvolutionKeyForCampaign(campaignId: string, tenantId: string): Promise<string | null> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, tenantId },
      select: { instance: { select: { evolutionKey: true } } },
    });
    return campaign?.instance.evolutionKey ?? null;
  },

  /** Status atual da campanha — usado para detectar PAUSED/CANCELLED durante o loop. */
  async getStatus(campaignId: string, tenantId: string): Promise<CampaignStatus | null> {
    const c = await prisma.campaign.findFirst({
      where: { id: campaignId, tenantId },
      select: { status: true },
    });
    return c?.status ?? null;
  },

  /** Contatos ainda PENDING da campanha, em ordem estável de criação. */
  pendingContacts(
    campaignId: string,
  ): Promise<Pick<CampaignContact, 'id' | 'phone' | 'contactId'>[]> {
    return prisma.campaignContact.findMany({
      where: { campaignId, status: 'PENDING' },
      orderBy: { phone: 'asc' },
      select: { id: true, phone: true, contactId: true },
    });
  },

  /** Atualiza o status (e timestamps/erro) de um CampaignContact. */
  async updateContactStatus(
    campaignContactId: string,
    status: CampaignContactStatus,
    extra: { externalId?: string | null; errorMessage?: string | null } = {},
  ): Promise<void> {
    const now = new Date();
    await prisma.campaignContact.update({
      where: { id: campaignContactId },
      data: {
        status,
        ...(status === 'SENT' ? { sentAt: now } : {}),
        ...(status === 'FAILED' ? { failedAt: now } : {}),
        ...(extra.externalId !== undefined ? { externalId: extra.externalId } : {}),
        ...(extra.errorMessage !== undefined ? { errorMessage: extra.errorMessage } : {}),
      },
    });
  },

  /** Incrementa contadores agregados da campanha (sent/failed). */
  async incrementCounters(
    campaignId: string,
    tenantId: string,
    delta: { sent?: number; failed?: number },
  ): Promise<void> {
    await prisma.campaign.updateMany({
      where: { id: campaignId, tenantId },
      data: {
        ...(delta.sent ? { sentCount: { increment: delta.sent } } : {}),
        ...(delta.failed ? { failedCount: { increment: delta.failed } } : {}),
      },
    });
  },

  /**
   * Persiste uma Message OUTBOUND para o envio da campanha (best-effort).
   * Resolve/cria a conversa do contato na instância da campanha, reusando o
   * mesmo padrão do webhook-receiver (uma conversa por contato+instância).
   */
  async recordOutboundMessage(input: {
    tenantId: string;
    instanceId: string;
    contactId: string;
    content: string | null;
    type?: Prisma.MessageCreateInput['type'];
    mediaUrl?: string | null;
    mediaCaption?: string | null;
    externalId?: string | null;
  }): Promise<void> {
    const existing = await prisma.conversation.findFirst({
      where: { tenantId: input.tenantId, instanceId: input.instanceId, contactId: input.contactId },
      select: { id: true },
    });
    const conversationId =
      existing?.id ??
      (
        await prisma.conversation.create({
          data: {
            tenantId: input.tenantId,
            instanceId: input.instanceId,
            contactId: input.contactId,
          },
          select: { id: true },
        })
      ).id;

    await prisma.message.create({
      data: {
        conversationId,
        externalId: input.externalId ?? undefined,
        direction: 'OUTBOUND',
        type: input.type ?? 'TEXT',
        content: input.content,
        mediaUrl: input.mediaUrl ?? undefined,
        mediaCaption: input.mediaCaption ?? undefined,
        status: 'SENT',
        timestamp: new Date(),
      },
    });
  },
};
