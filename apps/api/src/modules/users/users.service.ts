import { supabaseAdmin } from '@core/supabase.js';
import { logger } from '@core/logger.js';
import { AppError, ConflictError, ForbiddenError, NotFoundError } from '@core/errors.js';
import { usersRepository } from './users.repository.js';
import type { InviteUserDto, UpdateRoleDto } from './users.schema.js';
import type { User } from '@prisma/client';

interface UserDto {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
}

function toDto(u: User): UserDto {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    isActive: u.isActive,
    createdAt: u.createdAt,
  };
}

export const usersService = {
  async list(tenantId: string): Promise<UserDto[]> {
    const users = await usersRepository.listByTenant(tenantId);
    return users.map(toDto);
  },

  /** OWNER/ADMIN cria (convida) um novo usuário no próprio tenant. */
  async invite(tenantId: string, dto: InviteUserDto): Promise<UserDto> {
    const existing = await usersRepository.findByEmailInTenant(dto.email, tenantId);
    if (existing) throw new ConflictError('Já existe um usuário com este e-mail no tenant');

    // 1) Cria no Supabase Auth
    const created = await supabaseAdmin.auth.admin.createUser({
      email: dto.email,
      password: dto.password,
      email_confirm: true,
      app_metadata: { tenant_id: tenantId, role: dto.role },
    });
    if (created.error || !created.data.user) {
      const msg = created.error?.message ?? 'Falha ao criar usuário';
      if (/already|registered|exists/i.test(msg)) {
        throw new ConflictError('E-mail já cadastrado no Supabase Auth');
      }
      throw new AppError(msg, 502, 'SUPABASE_ERROR');
    }

    // 2) Persiste no banco (rollback do Supabase em falha)
    try {
      const user = await usersRepository.create({
        tenantId,
        supabaseUid: created.data.user.id,
        email: dto.email,
        fullName: dto.fullName,
        role: dto.role,
      });
      return toDto(user);
    } catch (err) {
      await supabaseAdmin.auth.admin.deleteUser(created.data.user.id).catch(() => undefined);
      logger.error({ err, tenantId }, 'Falha ao persistir usuário convidado');
      throw err;
    }
  },

  async updateRole(tenantId: string, id: string, dto: UpdateRoleDto): Promise<UserDto> {
    const target = await usersRepository.findByIdInTenant(id, tenantId);
    if (!target) throw new NotFoundError('Usuário');

    // Não permite rebaixar o último OWNER
    if (target.role === 'OWNER' && dto.role !== 'OWNER') {
      const owners = await usersRepository.countByRole(tenantId, 'OWNER');
      if (owners <= 1) throw new ForbiddenError('Não é possível rebaixar o único OWNER do tenant');
    }

    await usersRepository.updateRole(id, tenantId, dto.role);
    // Mantém o JWT em sincronia com o novo papel
    await supabaseAdmin.auth.admin
      .updateUserById(target.supabaseUid, { app_metadata: { tenant_id: tenantId, role: dto.role } })
      .catch(err => logger.warn({ err }, 'Falha ao atualizar app_metadata do papel'));

    const updated = await usersRepository.findByIdInTenant(id, tenantId);
    return toDto(updated as User);
  },

  async remove(tenantId: string, id: string, requesterUid: string): Promise<void> {
    const target = await usersRepository.findByIdInTenant(id, tenantId);
    if (!target) throw new NotFoundError('Usuário');
    if (target.supabaseUid === requesterUid) {
      throw new ForbiddenError('Você não pode remover a si mesmo');
    }
    if (target.role === 'OWNER') {
      const owners = await usersRepository.countByRole(tenantId, 'OWNER');
      if (owners <= 1) throw new ForbiddenError('Não é possível remover o único OWNER do tenant');
    }

    await usersRepository.remove(id, tenantId);
    await supabaseAdmin.auth.admin
      .deleteUser(target.supabaseUid)
      .catch(err => logger.warn({ err }, 'Falha ao remover usuário no Supabase Auth'));
  },
};
