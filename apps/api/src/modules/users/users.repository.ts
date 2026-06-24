import { prisma } from '@core/prisma.js';
import type { User, UserRole } from '@prisma/client';

/** Camada de acesso a dados de usuários (sempre escopada por tenant). */
export const usersRepository = {
  listByTenant(tenantId: string): Promise<User[]> {
    return prisma.user.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } });
  },

  findByIdInTenant(id: string, tenantId: string): Promise<User | null> {
    return prisma.user.findFirst({ where: { id, tenantId } });
  },

  findByEmailInTenant(email: string, tenantId: string): Promise<User | null> {
    return prisma.user.findFirst({ where: { email, tenantId } });
  },

  create(input: {
    tenantId: string;
    supabaseUid: string;
    email: string;
    fullName: string;
    role: UserRole;
  }): Promise<User> {
    return prisma.user.create({ data: input });
  },

  async updateRole(id: string, tenantId: string, role: UserRole): Promise<number> {
    const res = await prisma.user.updateMany({ where: { id, tenantId }, data: { role } });
    return res.count;
  },

  async remove(id: string, tenantId: string): Promise<number> {
    const res = await prisma.user.deleteMany({ where: { id, tenantId } });
    return res.count;
  },

  countByRole(tenantId: string, role: UserRole): Promise<number> {
    return prisma.user.count({ where: { tenantId, role } });
  },
};
