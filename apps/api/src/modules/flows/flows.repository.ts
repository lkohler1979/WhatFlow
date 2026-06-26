import { prisma } from '@core/prisma.js';
import type { Flow, Prisma, FlowTriggerType } from '@prisma/client';

/** Acesso a dados de fluxos — sempre escopado por tenant. */
export const flowsRepository = {
  listByTenant(tenantId: string): Promise<Flow[]> {
    return prisma.flow.findMany({ where: { tenantId }, orderBy: { updatedAt: 'desc' } });
  },

  findByIdInTenant(id: string, tenantId: string): Promise<Flow | null> {
    return prisma.flow.findFirst({ where: { id, tenantId } });
  },

  create(data: Prisma.FlowUncheckedCreateInput): Promise<Flow> {
    return prisma.flow.create({ data });
  },

  async update(id: string, tenantId: string, data: Prisma.FlowUpdateInput): Promise<number> {
    const res = await prisma.flow.updateMany({ where: { id, tenantId }, data });
    return res.count;
  },

  async remove(id: string, tenantId: string): Promise<number> {
    const res = await prisma.flow.deleteMany({ where: { id, tenantId } });
    return res.count;
  },

  /** Arquiva outros fluxos PUBLICADOS com o mesmo gatilho (evita conflito de trigger). */
  async archivePublishedWithTrigger(input: {
    tenantId: string;
    instanceId: string | null;
    triggerType: FlowTriggerType;
    triggerValue: string | null;
    exceptId: string;
  }): Promise<void> {
    await prisma.flow.updateMany({
      where: {
        tenantId: input.tenantId,
        instanceId: input.instanceId,
        triggerType: input.triggerType,
        triggerValue: input.triggerValue,
        status: 'PUBLISHED',
        id: { not: input.exceptId },
      },
      data: { status: 'ARCHIVED' },
    });
  },

  /** Fluxos publicados e ativos do tenant para uma instância (usado pelo bot — T-022). */
  findActivePublished(tenantId: string, instanceId: string): Promise<Flow[]> {
    return prisma.flow.findMany({
      where: {
        tenantId,
        status: 'PUBLISHED',
        isActive: true,
        OR: [{ instanceId }, { instanceId: null }],
      },
      orderBy: { priority: 'desc' },
    });
  },
};
