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

beforeEach(() => jest.clearAllMocks());

describe('tagsService attach/detach em conversa (T-040)', () => {
  it('anexa tag à conversa (ambos do tenant)', async () => {
    mockRepo.conversationBelongsToTenant.mockResolvedValue({ id: 'cv1' });
    mockRepo.findByIdInTenant.mockResolvedValue(tag());
    mockRepo.attachToConversation.mockResolvedValue(undefined);
    await tagsService.attachToConversation('t1', 'cv1', 'tag-1');
    expect(mockRepo.attachToConversation).toHaveBeenCalledWith('cv1', 'tag-1');
  });

  it('404 quando a conversa não é do tenant', async () => {
    mockRepo.conversationBelongsToTenant.mockResolvedValue(null);
    await expect(tagsService.attachToConversation('t1', 'cv1', 'tag-1')).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(mockRepo.attachToConversation).not.toHaveBeenCalled();
  });

  it('404 quando a tag não é do tenant', async () => {
    mockRepo.conversationBelongsToTenant.mockResolvedValue({ id: 'cv1' });
    mockRepo.findByIdInTenant.mockResolvedValue(null);
    await expect(tagsService.attachToConversation('t1', 'cv1', 'tag-1')).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(mockRepo.attachToConversation).not.toHaveBeenCalled();
  });

  it('remove associação tenant-scoped', async () => {
    mockRepo.conversationBelongsToTenant.mockResolvedValue({ id: 'cv1' });
    mockRepo.detachFromConversation.mockResolvedValue(1);
    await tagsService.detachFromConversation('t1', 'cv1', 'tag-1');
    expect(mockRepo.detachFromConversation).toHaveBeenCalledWith('cv1', 'tag-1');
  });

  it('detach: 404 quando a conversa não é do tenant', async () => {
    mockRepo.conversationBelongsToTenant.mockResolvedValue(null);
    await expect(tagsService.detachFromConversation('t1', 'cv1', 'tag-1')).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(mockRepo.detachFromConversation).not.toHaveBeenCalled();
  });
});
