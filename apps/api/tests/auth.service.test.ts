import { authService } from '@modules/auth/auth.service.js';
import { authRepository as repo } from '@modules/auth/auth.repository.js';
import { supabaseAdmin, supabaseAuth } from '@core/supabase.js';

jest.mock('@modules/auth/auth.repository.js');
jest.mock('@core/supabase.js', () => ({
  __esModule: true,
  supabaseAdmin: {
    auth: {
      admin: {
        createUser: jest.fn(),
        updateUserById: jest.fn(),
        deleteUser: jest.fn(),
        signOut: jest.fn(),
      },
    },
  },
  supabaseAuth: {
    auth: {
      signInWithPassword: jest.fn(),
      refreshSession: jest.fn(),
      resetPasswordForEmail: jest.fn(),
    },
  },
}));

const mockRepo = repo as jest.Mocked<typeof repo>;
const admin = supabaseAdmin.auth.admin as unknown as {
  createUser: jest.Mock;
  updateUserById: jest.Mock;
  deleteUser: jest.Mock;
  signOut: jest.Mock;
};
const auth = supabaseAuth.auth as unknown as {
  signInWithPassword: jest.Mock;
  refreshSession: jest.Mock;
  resetPasswordForEmail: jest.Mock;
};

const session = {
  access_token: 'acc',
  refresh_token: 'ref',
  expires_in: 3600,
};

beforeEach(() => {
  jest.clearAllMocks();
  admin.deleteUser.mockResolvedValue({});
  auth.signInWithPassword.mockResolvedValue({
    data: { session, user: { id: 'uid-1' } },
    error: null,
  });
});

describe('authService.register', () => {
  const dto = {
    companyName: 'Minha Empresa Ltda',
    email: 'owner@example.com',
    password: 'senha1234',
    fullName: 'Owner',
  };

  beforeEach(() => {
    admin.createUser.mockResolvedValue({ data: { user: { id: 'uid-1' } }, error: null });
    admin.updateUserById.mockResolvedValue({ error: null });
    mockRepo.slugExists.mockResolvedValue(false);
    mockRepo.createTenantWithOwner.mockResolvedValue({
      tenant: { id: 'tenant-1' },
      user: { id: 'u1' },
    } as never);
  });

  it('cria usuário no Supabase, tenant no banco e retorna sessão', async () => {
    const r = await authService.register(dto);
    expect(admin.createUser).toHaveBeenCalled();
    expect(mockRepo.createTenantWithOwner).toHaveBeenCalledWith(
      expect.objectContaining({ supabaseUid: 'uid-1', companyName: dto.companyName }),
    );
    expect(admin.updateUserById).toHaveBeenCalledWith(
      'uid-1',
      expect.objectContaining({ app_metadata: { tenant_id: 'tenant-1', role: 'OWNER' } }),
    );
    expect(r.user).toMatchObject({ tenantId: 'tenant-1', role: 'OWNER' });
    expect(r.session.accessToken).toBe('acc');
  });

  it('gera slug único quando o primeiro já existe', async () => {
    mockRepo.slugExists.mockResolvedValueOnce(true).mockResolvedValue(false);
    await authService.register(dto);
    const arg = mockRepo.createTenantWithOwner.mock.calls[0][0];
    expect(arg.slug).toMatch(/-1$/);
  });

  it('409 quando o e-mail já existe no Supabase', async () => {
    admin.createUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'User already registered' },
    });
    await expect(authService.register(dto)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('502 em erro genérico do Supabase', async () => {
    admin.createUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'boom' },
    });
    await expect(authService.register(dto)).rejects.toMatchObject({ statusCode: 502 });
  });

  it('faz rollback do Supabase se persistir tenant falhar', async () => {
    mockRepo.createTenantWithOwner.mockRejectedValue(new Error('db'));
    await expect(authService.register(dto)).rejects.toThrow('db');
    expect(admin.deleteUser).toHaveBeenCalledWith('uid-1');
  });

  it('rollback (Supabase + tenant) se updateUserById falhar', async () => {
    admin.updateUserById.mockResolvedValue({ error: { message: 'meta' } });
    mockRepo.deleteTenant.mockResolvedValue(undefined);
    await expect(authService.register(dto)).rejects.toMatchObject({ statusCode: 502 });
    expect(admin.deleteUser).toHaveBeenCalled();
    expect(mockRepo.deleteTenant).toHaveBeenCalledWith('tenant-1');
  });
});

describe('authService.login', () => {
  it('retorna perfil + sessão e toca lastLogin', async () => {
    mockRepo.findUserBySupabaseUid.mockResolvedValue({
      supabaseUid: 'uid-1',
      email: 'owner@example.com',
      fullName: 'Owner',
      role: 'OWNER',
      tenantId: 'tenant-1',
    } as never);
    mockRepo.touchLastLogin.mockResolvedValue(undefined);

    const r = await authService.login({ email: 'owner@example.com', password: 'x' });
    expect(r.user.tenantId).toBe('tenant-1');
    expect(mockRepo.touchLastLogin).toHaveBeenCalledWith('uid-1');
  });

  it('401 quando o perfil não existe no banco', async () => {
    mockRepo.findUserBySupabaseUid.mockResolvedValue(null);
    await expect(
      authService.login({ email: 'x@x.com', password: 'x' }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('401 quando credenciais inválidas', async () => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: { message: 'invalid' } });
    await expect(
      authService.login({ email: 'x@x.com', password: 'bad' }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe('authService.refresh', () => {
  it('devolve nova sessão', async () => {
    auth.refreshSession.mockResolvedValue({ data: { session }, error: null });
    const r = await authService.refresh({ refreshToken: 'ref' });
    expect(r).toEqual({ accessToken: 'acc', refreshToken: 'ref', expiresIn: 3600 });
  });

  it('401 quando refresh inválido', async () => {
    auth.refreshSession.mockResolvedValue({ data: {}, error: { message: 'bad' } });
    await expect(authService.refresh({ refreshToken: 'x' })).rejects.toMatchObject({
      statusCode: 401,
    });
  });
});

describe('authService.requestPasswordReset', () => {
  it('chama resetPasswordForEmail com redirectTo', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    await authService.requestPasswordReset({ email: 'a@b.com' });
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'a@b.com',
      expect.objectContaining({ redirectTo: expect.stringContaining('/auth/reset-password') }),
    );
  });

  it('502 quando o Supabase falha', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: { message: 'boom' } });
    await expect(
      authService.requestPasswordReset({ email: 'a@b.com' }),
    ).rejects.toMatchObject({ statusCode: 502 });
  });
});

describe('authService.logout', () => {
  it('no-op sem token', async () => {
    await authService.logout(undefined);
    expect(admin.signOut).not.toHaveBeenCalled();
  });

  it('invalida a sessão quando há token', async () => {
    admin.signOut.mockResolvedValue({});
    await authService.logout('acc');
    expect(admin.signOut).toHaveBeenCalledWith('acc');
  });

  it('não propaga erro de signOut', async () => {
    admin.signOut.mockRejectedValue(new Error('x'));
    await expect(authService.logout('acc')).resolves.toBeUndefined();
  });
});
