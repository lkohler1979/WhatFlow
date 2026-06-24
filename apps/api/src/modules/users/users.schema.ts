import { z } from 'zod';

// OWNER não é convidável por aqui — há sempre exatamente um dono inicial (o registro).
export const InviteUserSchema = z.object({
  email: z.string().email('E-mail inválido'),
  fullName: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
  role: z.enum(['ADMIN', 'AGENT', 'VIEWER']),
});

export const UpdateRoleSchema = z.object({
  role: z.enum(['OWNER', 'ADMIN', 'AGENT', 'VIEWER']),
});

export const UserIdParamSchema = z.object({
  id: z.string().uuid('ID inválido'),
});

export type InviteUserDto = z.infer<typeof InviteUserSchema>;
export type UpdateRoleDto = z.infer<typeof UpdateRoleSchema>;
