import { prisma } from '@core/prisma.js';
import type { Tenant, User } from '@prisma/client';

/**
 * Camada de acesso a dados de autenticação.
 * Única camada autorizada a falar com o Prisma.
 */
export const authRepository = {
  /** Cria tenant + usuário OWNER numa única transação. */
  async createTenantWithOwner(input: {
    companyName: string;
    slug: string;
    supabaseUid: string;
    email: string;
    fullName: string;
  }): Promise<{ tenant: Tenant; user: User }> {
    return prisma.$transaction(async tx => {
      const tenant = await tx.tenant.create({
        data: { name: input.companyName, slug: input.slug },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          supabaseUid: input.supabaseUid,
          email: input.email,
          fullName: input.fullName,
          role: 'OWNER',
        },
      });

      return { tenant, user };
    });
  },

  /** Verifica se um slug já existe (para garantir unicidade). */
  async slugExists(slug: string): Promise<boolean> {
    const count = await prisma.tenant.count({ where: { slug } });
    return count > 0;
  },

  async findUserBySupabaseUid(supabaseUid: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { supabaseUid } });
  },

  async touchLastLogin(supabaseUid: string): Promise<void> {
    await prisma.user.updateMany({
      where: { supabaseUid },
      data: { lastLoginAt: new Date() },
    });
  },

  /** Remove o tenant (e em cascata o usuário) — usado em rollback de registro. */
  async deleteTenant(tenantId: string): Promise<void> {
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
  },
};
