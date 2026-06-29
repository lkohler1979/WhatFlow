import { prisma } from '@core/prisma.js';
import type { Campaign, CampaignStatus, Contact, Prisma } from '@prisma/client';

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
};
