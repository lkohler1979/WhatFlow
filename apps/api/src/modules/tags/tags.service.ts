import { ConflictError, NotFoundError } from '@core/errors.js';
import { tagsRepository } from './tags.repository.js';
import type { CreateTagDto, UpdateTagDto } from './tags.schema.js';
import type { Tag } from '@prisma/client';

interface TagDto {
  id: string;
  name: string;
  color: string;
  createdAt: Date;
}

function toDto(t: Tag): TagDto {
  return { id: t.id, name: t.name, color: t.color, createdAt: t.createdAt };
}

export const tagsService = {
  async list(tenantId: string, q?: string): Promise<TagDto[]> {
    const tags = await tagsRepository.listByTenant(tenantId, q);
    return tags.map(toDto);
  },

  async get(tenantId: string, id: string): Promise<TagDto> {
    const tag = await tagsRepository.findByIdInTenant(id, tenantId);
    if (!tag) throw new NotFoundError('Tag');
    return toDto(tag);
  },

  async create(tenantId: string, dto: CreateTagDto): Promise<TagDto> {
    const existing = await tagsRepository.findByNameInTenant(dto.name, tenantId);
    if (existing) throw new ConflictError('Já existe uma tag com este nome');
    const tag = await tagsRepository.create({
      tenantId,
      name: dto.name,
      color: dto.color,
    });
    return toDto(tag);
  },

  async update(tenantId: string, id: string, dto: UpdateTagDto): Promise<TagDto> {
    const existing = await tagsRepository.findByIdInTenant(id, tenantId);
    if (!existing) throw new NotFoundError('Tag');

    if (dto.name && dto.name.toLowerCase() !== existing.name.toLowerCase()) {
      const byName = await tagsRepository.findByNameInTenant(dto.name, tenantId);
      if (byName && byName.id !== id) {
        throw new ConflictError('Já existe uma tag com este nome');
      }
    }

    const data: { name?: string; color?: string } = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.color !== undefined) data.color = dto.color;
    await tagsRepository.update(id, tenantId, data);
    return this.get(tenantId, id);
  },

  async remove(tenantId: string, id: string): Promise<void> {
    const removed = await tagsRepository.remove(id, tenantId);
    if (removed === 0) throw new NotFoundError('Tag');
  },

  /** Anexa uma tag a um contato — ambos validados no tenant. Idempotente. */
  async attachToContact(tenantId: string, contactId: string, tagId: string): Promise<void> {
    const contact = await tagsRepository.contactBelongsToTenant(contactId, tenantId);
    if (!contact) throw new NotFoundError('Contato');
    const tag = await tagsRepository.findByIdInTenant(tagId, tenantId);
    if (!tag) throw new NotFoundError('Tag');
    await tagsRepository.attachToContact(contactId, tagId);
  },

  /** Remove a tag do contato — 404 se o contato não for do tenant. */
  async detachFromContact(tenantId: string, contactId: string, tagId: string): Promise<void> {
    const contact = await tagsRepository.contactBelongsToTenant(contactId, tenantId);
    if (!contact) throw new NotFoundError('Contato');
    await tagsRepository.detachFromContact(contactId, tagId);
  },
};
