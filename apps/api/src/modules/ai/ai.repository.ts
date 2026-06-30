import { prisma } from '@core/prisma.js';
import type { AiConfig, Prisma } from '@prisma/client';

/**
 * Acesso a dados da config de IA — sempre escopado por tenant.
 *
 * O schema permite múltiplas linhas por tenant (índice não-único), mas a
 * UI/SaaS trata como singleton: usamos a config mais recente do tenant como
 * "a config ativa" e fazemos upsert sobre ela.
 */
export const aiRepository = {
  /** Config mais recente do tenant (a "ativa"), ou null se nunca configurada. */
  findByTenant(tenantId: string): Promise<AiConfig | null> {
    return prisma.aiConfig.findFirst({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
    });
  },

  create(
    tenantId: string,
    data: Omit<Prisma.AiConfigUncheckedCreateInput, 'tenantId'>,
  ): Promise<AiConfig> {
    return prisma.aiConfig.create({ data: { ...data, tenantId } });
  },

  async update(
    id: string,
    tenantId: string,
    data: Prisma.AiConfigUpdateInput,
  ): Promise<AiConfig | null> {
    const res = await prisma.aiConfig.updateMany({ where: { id, tenantId }, data });
    if (res.count === 0) return null;
    return prisma.aiConfig.findFirst({ where: { id, tenantId } });
  },
};
