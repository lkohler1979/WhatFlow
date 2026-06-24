import { prisma } from '@core/prisma.js';
import type { Instance, Prisma } from '@prisma/client';

/** Acesso a dados de instâncias — sempre escopado por tenant. */
export const instancesRepository = {
  listByTenant(tenantId: string): Promise<Instance[]> {
    return prisma.instance.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
  },

  findByIdInTenant(id: string, tenantId: string): Promise<Instance | null> {
    return prisma.instance.findFirst({ where: { id, tenantId } });
  },

  create(data: Prisma.InstanceUncheckedCreateInput): Promise<Instance> {
    return prisma.instance.create({ data });
  },

  async update(id: string, tenantId: string, data: Prisma.InstanceUpdateInput): Promise<number> {
    const res = await prisma.instance.updateMany({ where: { id, tenantId }, data });
    return res.count;
  },

  async remove(id: string, tenantId: string): Promise<number> {
    const res = await prisma.instance.deleteMany({ where: { id, tenantId } });
    return res.count;
  },
};
