import { usersService } from '@modules/users/users.service.js';
import { usersRepository as repo } from '@modules/users/users.repository.js';
import { supabaseAdmin } from '@core/supabase.js';

jest.mock('@modules/users/users.repository.js');
jest.mock('@core/supabase.js', () => ({
  __esModule: true,
  supabaseAdmin: {
    auth: {
      admin: {
        createUser: jest.fn(),
        updateUserById: jest.fn(),
        deleteUser: jest.fn(),
      },
    },
  },
}));

const mockRepo = repo as jest.Mocked<typeof repo>;
const admin = supabaseAdmin.auth.admin as unknown as {
  createUser: jest.Mock;
  updateUserById: jest.Mock;
  deleteUser: jest.Mock;
};

const user = (over: Record<string, unknown> = {}) =>
  ({
    id: 'u1',
    supabaseUid: 'uid-1',
    email: 'a@b.com',
    fullName: 'Ana',
    role: 'AGENT',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...over,
  }) as never;

beforeEach(() => {
  jest.clearAllMocks();
  admin.deleteUser.mockResolvedValue({});
  admin.updateUserById.mockResolvedValue({});
});

describe('usersService.list', () => {
  it('mapeia para DTO', async () => {
    mockRepo.listByTenant.mockResolvedValue([user()]);
    const r = await usersService.list('t1');
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ id: 'u1', email: 'a@b.com', role: 'AGENT' });
  });
});

describe('usersService.invite', () => {
  const dto = { email: 'a@b.com', password: 'senha1234', fullName: 'Ana', role: 'AGENT' as const };

  it('convida e persiste', async () => {
    mockRepo.findByEmailInTenant.mockResolvedValue(null);
    admin.createUser.mockResolvedValue({ data: { user: { id: 'uid-1' } }, error: null });
    mockRepo.create.mockResolvedValue(user());
    const r = await usersService.invite('t1', dto);
    expect(admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ app_metadata: { tenant_id: 't1', role: 'AGENT' } }),
    );
    expect(r.email).toBe('a@b.com');
  });

  it('409 quando o e-mail já existe no tenant', async () => {
    mockRepo.findByEmailInTenant.mockResolvedValue(user());
    await expect(usersService.invite('t1', dto)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('409 quando já existe no Supabase Auth', async () => {
    mockRepo.findByEmailInTenant.mockResolvedValue(null);
    admin.createUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'already registered' },
    });
    await expect(usersService.invite('t1', dto)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('502 em erro genérico do Supabase', async () => {
    mockRepo.findByEmailInTenant.mockResolvedValue(null);
    admin.createUser.mockResolvedValue({ data: { user: null }, error: { message: 'boom' } });
    await expect(usersService.invite('t1', dto)).rejects.toMatchObject({ statusCode: 502 });
  });

  it('rollback do Supabase se persistir falhar', async () => {
    mockRepo.findByEmailInTenant.mockResolvedValue(null);
    admin.createUser.mockResolvedValue({ data: { user: { id: 'uid-1' } }, error: null });
    mockRepo.create.mockRejectedValue(new Error('db'));
    await expect(usersService.invite('t1', dto)).rejects.toThrow('db');
    expect(admin.deleteUser).toHaveBeenCalledWith('uid-1');
  });
});

describe('usersService.updateRole', () => {
  it('atualiza papel e sincroniza app_metadata', async () => {
    mockRepo.findByIdInTenant
      .mockResolvedValueOnce(user({ role: 'AGENT' }))
      .mockResolvedValueOnce(user({ role: 'ADMIN' }));
    mockRepo.updateRole.mockResolvedValue(1);
    const r = await usersService.updateRole('t1', 'u1', { role: 'ADMIN' });
    expect(mockRepo.updateRole).toHaveBeenCalledWith('u1', 't1', 'ADMIN');
    expect(admin.updateUserById).toHaveBeenCalled();
    expect(r.role).toBe('ADMIN');
  });

  it('404 quando usuário não existe', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(null);
    await expect(
      usersService.updateRole('t1', 'u1', { role: 'ADMIN' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('403 ao rebaixar o único OWNER', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(user({ role: 'OWNER' }));
    mockRepo.countByRole.mockResolvedValue(1);
    await expect(
      usersService.updateRole('t1', 'u1', { role: 'ADMIN' }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('permite rebaixar OWNER quando há mais de um', async () => {
    mockRepo.findByIdInTenant
      .mockResolvedValueOnce(user({ role: 'OWNER' }))
      .mockResolvedValueOnce(user({ role: 'ADMIN' }));
    mockRepo.countByRole.mockResolvedValue(2);
    mockRepo.updateRole.mockResolvedValue(1);
    const r = await usersService.updateRole('t1', 'u1', { role: 'ADMIN' });
    expect(r.role).toBe('ADMIN');
  });
});

describe('usersService.remove', () => {
  it('remove no banco e no Supabase', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(user({ supabaseUid: 'uid-target', role: 'AGENT' }));
    mockRepo.remove.mockResolvedValue(1);
    await usersService.remove('t1', 'u1', 'uid-requester');
    expect(mockRepo.remove).toHaveBeenCalledWith('u1', 't1');
    expect(admin.deleteUser).toHaveBeenCalledWith('uid-target');
  });

  it('404 quando não existe', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(null);
    await expect(usersService.remove('t1', 'u1', 'req')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('403 ao remover a si mesmo', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(user({ supabaseUid: 'uid-me' }));
    await expect(usersService.remove('t1', 'u1', 'uid-me')).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('403 ao remover o único OWNER', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(user({ supabaseUid: 'uid-o', role: 'OWNER' }));
    mockRepo.countByRole.mockResolvedValue(1);
    await expect(usersService.remove('t1', 'u1', 'uid-req')).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});
