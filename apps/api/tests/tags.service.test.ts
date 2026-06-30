import { tagsService } from '@modules/tags/tags.service.js';
import { tagsRepository as repo } from '@modules/tags/tags.repository.js';
import type { Tag } from '@prisma/client';

jest.mock('@modules/tags/tags.repository.js');

const mockRepo = repo as jest.Mocked<typeof repo>;

const tag = (over: Partial<Tag> = {}): Tag =>
  ({
    id: 'tag-1',
    tenantId: 't1',
    name: 'Lead',
    color: '#3498DB',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...over,
  }) as Tag;

beforeEach(() => {
  jest.clearAllMocks();
  mockRepo.findByNameInTenant.mockResolvedValue(null);
});

describe('tagsService.list', () => {
  it('lista tags do tenant e mapeia DTO', async () => {
    mockRepo.listByTenant.mockResolvedValue([tag(), tag({ id: 'tag-2', name: 'VIP' })]);
    const r = await tagsService.list('t1');
    expect(mockRepo.listByTenant).toHaveBeenCalledWith('t1', undefined);
    expect(r).toHaveLength(2);
    expect(r[0]).toEqual({
      id: 'tag-1',
      name: 'Lead',
      color: '#3498DB',
      createdAt: expect.any(Date),
    });
  });

  it('repassa q (prefixo) para o autocomplete', async () => {
    mockRepo.listByTenant.mockResolvedValue([tag()]);
    await tagsService.list('t1', 'le');
    expect(mockRepo.listByTenant).toHaveBeenCalledWith('t1', 'le');
  });
});

describe('tagsService.create', () => {
  it('cria tag tenant-scoped', async () => {
    mockRepo.create.mockResolvedValue(tag());
    const r = await tagsService.create('t1', { name: 'Lead', color: '#3498DB' });
    expect(mockRepo.create).toHaveBeenCalledWith({
      tenantId: 't1',
      name: 'Lead',
      color: '#3498DB',
    });
    expect(r.name).toBe('Lead');
  });

  it('409 quando nome duplicado no tenant', async () => {
    mockRepo.findByNameInTenant.mockResolvedValue(tag());
    await expect(
      tagsService.create('t1', { name: 'Lead', color: '#3498DB' }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'CONFLICT' });
    expect(mockRepo.create).not.toHaveBeenCalled();
  });
});

describe('tagsService.update', () => {
  it('renomeia quando nome livre', async () => {
    mockRepo.findByIdInTenant
      .mockResolvedValueOnce(tag())
      .mockResolvedValueOnce(tag({ name: 'Cliente' }));
    mockRepo.update.mockResolvedValue(1);
    const r = await tagsService.update('t1', 'tag-1', { name: 'Cliente' });
    expect(mockRepo.update).toHaveBeenCalledWith('tag-1', 't1', { name: 'Cliente' });
    expect(r.name).toBe('Cliente');
  });

  it('404 quando tag inexistente', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(null);
    await expect(tagsService.update('t1', 'x', { name: 'Y' })).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('409 ao renomear para nome já usado por outra tag', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(tag({ id: 'tag-1', name: 'Lead' }));
    mockRepo.findByNameInTenant.mockResolvedValue(tag({ id: 'tag-2', name: 'VIP' }));
    await expect(tagsService.update('t1', 'tag-1', { name: 'VIP' })).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});

describe('tagsService.remove', () => {
  it('remove tenant-scoped', async () => {
    mockRepo.remove.mockResolvedValue(1);
    await expect(tagsService.remove('t1', 'tag-1')).resolves.toBeUndefined();
    expect(mockRepo.remove).toHaveBeenCalledWith('tag-1', 't1');
  });

  it('404 quando nada removido', async () => {
    mockRepo.remove.mockResolvedValue(0);
    await expect(tagsService.remove('t1', 'tag-1')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('tagsService attach/detach em contato', () => {
  it('anexa tag a contato (ambos do tenant)', async () => {
    mockRepo.contactBelongsToTenant.mockResolvedValue({ id: 'c1' });
    mockRepo.findByIdInTenant.mockResolvedValue(tag());
    mockRepo.attachToContact.mockResolvedValue(undefined);
    await tagsService.attachToContact('t1', 'c1', 'tag-1');
    expect(mockRepo.attachToContact).toHaveBeenCalledWith('c1', 'tag-1');
  });

  it('404 quando contato não é do tenant', async () => {
    mockRepo.contactBelongsToTenant.mockResolvedValue(null);
    await expect(tagsService.attachToContact('t1', 'c1', 'tag-1')).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(mockRepo.attachToContact).not.toHaveBeenCalled();
  });

  it('404 quando tag não é do tenant', async () => {
    mockRepo.contactBelongsToTenant.mockResolvedValue({ id: 'c1' });
    mockRepo.findByIdInTenant.mockResolvedValue(null);
    await expect(tagsService.attachToContact('t1', 'c1', 'tag-1')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('remove associação tenant-scoped', async () => {
    mockRepo.contactBelongsToTenant.mockResolvedValue({ id: 'c1' });
    mockRepo.detachFromContact.mockResolvedValue(1);
    await tagsService.detachFromContact('t1', 'c1', 'tag-1');
    expect(mockRepo.detachFromContact).toHaveBeenCalledWith('c1', 'tag-1');
  });

  it('detach: 404 quando contato não é do tenant', async () => {
    mockRepo.contactBelongsToTenant.mockResolvedValue(null);
    await expect(tagsService.detachFromContact('t1', 'c1', 'tag-1')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
