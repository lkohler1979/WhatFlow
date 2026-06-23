import { RegisterSchema, LoginSchema, RefreshSchema } from '@modules/auth/auth.schema.js';

describe('auth.schema', () => {
  describe('RegisterSchema', () => {
    it('aceita um payload de registro válido', () => {
      const result = RegisterSchema.safeParse({
        email: 'owner@empresa.com',
        password: 'segredo123',
        fullName: 'João Silva',
        companyName: 'Empresa Teste',
      });
      expect(result.success).toBe(true);
    });

    it('rejeita e-mail inválido', () => {
      const result = RegisterSchema.safeParse({
        email: 'nao-eh-email',
        password: 'segredo123',
        fullName: 'João Silva',
        companyName: 'Empresa Teste',
      });
      expect(result.success).toBe(false);
    });

    it('rejeita senha com menos de 8 caracteres', () => {
      const result = RegisterSchema.safeParse({
        email: 'owner@empresa.com',
        password: '123',
        fullName: 'João Silva',
        companyName: 'Empresa Teste',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('LoginSchema', () => {
    it('aceita credenciais válidas', () => {
      const result = LoginSchema.safeParse({
        email: 'owner@empresa.com',
        password: 'qualquer',
      });
      expect(result.success).toBe(true);
    });

    it('exige senha não vazia', () => {
      const result = LoginSchema.safeParse({ email: 'owner@empresa.com', password: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('RefreshSchema', () => {
    it('exige refreshToken', () => {
      expect(RefreshSchema.safeParse({}).success).toBe(false);
      expect(RefreshSchema.safeParse({ refreshToken: 'abc' }).success).toBe(true);
    });
  });
});
