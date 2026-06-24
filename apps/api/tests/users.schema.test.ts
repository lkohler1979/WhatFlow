import { InviteUserSchema, UpdateRoleSchema, UserIdParamSchema } from '@modules/users/users.schema.js';

describe('users.schema', () => {
  describe('InviteUserSchema', () => {
    it('aceita convite válido', () => {
      const r = InviteUserSchema.safeParse({
        email: 'agente@empresa.com',
        fullName: 'Agente Silva',
        password: 'segredo123',
        role: 'AGENT',
      });
      expect(r.success).toBe(true);
    });

    it('rejeita papel OWNER no convite', () => {
      const r = InviteUserSchema.safeParse({
        email: 'a@b.com',
        fullName: 'Ana',
        password: 'segredo123',
        role: 'OWNER',
      });
      expect(r.success).toBe(false);
    });

    it('rejeita senha curta', () => {
      const r = InviteUserSchema.safeParse({
        email: 'a@b.com',
        fullName: 'Ana',
        password: '123',
        role: 'ADMIN',
      });
      expect(r.success).toBe(false);
    });
  });

  describe('UpdateRoleSchema', () => {
    it('aceita papéis válidos', () => {
      expect(UpdateRoleSchema.safeParse({ role: 'ADMIN' }).success).toBe(true);
      expect(UpdateRoleSchema.safeParse({ role: 'INVALID' }).success).toBe(false);
    });
  });

  describe('UserIdParamSchema', () => {
    it('exige uuid', () => {
      expect(UserIdParamSchema.safeParse({ id: 'nao-uuid' }).success).toBe(false);
      expect(
        UserIdParamSchema.safeParse({ id: '11111111-1111-1111-1111-111111111111' }).success,
      ).toBe(true);
    });
  });
});
