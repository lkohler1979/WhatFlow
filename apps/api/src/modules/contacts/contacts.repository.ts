import { prisma } from '@core/prisma.js';
import type { Contact, Prisma } from '@prisma/client';

const contactInclude = {
  contactTags: { include: { tag: true } },
} satisfies Prisma.ContactInclude;

export type ContactWithTags = Prisma.ContactGetPayload<{ include: typeof contactInclude }>;

export interface ContactListOptions {
  search?: string;
  tagId?: string;
  page: number;
  pageSize: number;
}

export interface ContactImportInput {
  phone: string;
  name?: string;
  email?: string;
  customFields: Record<string, unknown>;
}

function buildWhere(tenantId: string, opts: Pick<ContactListOptions, 'search' | 'tagId'>) {
  const where: Prisma.ContactWhereInput = { tenantId };
  if (opts.search) {
    const search = opts.search.trim();
    const digits = search.replace(/\D/g, '');
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      ...(digits ? [{ phone: { contains: digits } }] : [{ phone: { contains: search } }]),
    ];
  }
  if (opts.tagId) {
    where.contactTags = { some: { tagId: opts.tagId } };
  }
  return where;
}

export const contactsRepository = {
  async listByTenant(
    tenantId: string,
    opts: ContactListOptions,
  ): Promise<{ data: ContactWithTags[]; total: number }> {
    const where = buildWhere(tenantId, opts);
    const [data, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        include: contactInclude,
        orderBy: [{ name: 'asc' }, { phone: 'asc' }],
        skip: (opts.page - 1) * opts.pageSize,
        take: opts.pageSize,
      }),
      prisma.contact.count({ where }),
    ]);
    return { data, total };
  },

  exportByTenant(tenantId: string, opts: Pick<ContactListOptions, 'search' | 'tagId'>) {
    return prisma.contact.findMany({
      where: buildWhere(tenantId, opts),
      include: contactInclude,
      orderBy: [{ name: 'asc' }, { phone: 'asc' }],
    });
  },

  findByIdInTenant(id: string, tenantId: string): Promise<ContactWithTags | null> {
    return prisma.contact.findFirst({ where: { id, tenantId }, include: contactInclude });
  },

  findByPhoneInTenant(phone: string, tenantId: string): Promise<Contact | null> {
    return prisma.contact.findFirst({ where: { phone, tenantId } });
  },

  countTagsInTenant(tenantId: string, tagIds: string[]): Promise<number> {
    if (tagIds.length === 0) return Promise.resolve(0);
    return prisma.tag.count({ where: { tenantId, id: { in: tagIds } } });
  },

  async create(
    data: Prisma.ContactUncheckedCreateInput,
    tagIds: string[] = [],
  ): Promise<ContactWithTags> {
    return prisma.$transaction(async tx => {
      const contact = await tx.contact.create({ data });
      if (tagIds.length > 0) {
        await tx.contactTag.createMany({
          data: tagIds.map(tagId => ({ contactId: contact.id, tagId })),
          skipDuplicates: true,
        });
      }
      return tx.contact.findUniqueOrThrow({ where: { id: contact.id }, include: contactInclude });
    });
  },

  async update(
    id: string,
    tenantId: string,
    data: Prisma.ContactUpdateInput,
    tagIds?: string[],
  ): Promise<ContactWithTags | null> {
    return prisma.$transaction(async tx => {
      const updated = await tx.contact.updateMany({ where: { id, tenantId }, data });
      if (updated.count === 0) return null;
      if (tagIds) {
        await tx.contactTag.deleteMany({ where: { contactId: id } });
        if (tagIds.length > 0) {
          await tx.contactTag.createMany({
            data: tagIds.map(tagId => ({ contactId: id, tagId })),
            skipDuplicates: true,
          });
        }
      }
      return tx.contact.findFirst({ where: { id, tenantId }, include: contactInclude });
    });
  },

  async remove(id: string, tenantId: string): Promise<number> {
    const res = await prisma.contact.deleteMany({ where: { id, tenantId } });
    return res.count;
  },

  /**
   * Find-or-create de contatos a partir de uma lista de telefones já
   * normalizados/validados e deduplicados. Cria em lote os que faltam e
   * retorna o par {id, phone} de TODOS os telefones informados (existentes +
   * recém-criados), na mesma ordem de entrada. Tenant-scoped, sem N+1.
   */
  async findOrCreateByPhones(
    tenantId: string,
    phones: string[],
  ): Promise<{ id: string; phone: string }[]> {
    if (phones.length === 0) return [];

    const existing = await prisma.contact.findMany({
      where: { tenantId, phone: { in: phones } },
      select: { id: true, phone: true },
    });
    const existingPhones = new Set(existing.map(c => c.phone));
    const missing = phones.filter(p => !existingPhones.has(p));

    if (missing.length > 0) {
      // Lote único; skipDuplicates protege contra corrida concorrente.
      await prisma.contact.createMany({
        data: missing.map(phone => ({ tenantId, phone, customFields: {} })),
        skipDuplicates: true,
      });
    }

    // Recarrega todos para obter os ids dos recém-criados (1 query).
    const all = await prisma.contact.findMany({
      where: { tenantId, phone: { in: phones } },
      select: { id: true, phone: true },
    });
    const byPhone = new Map(all.map(c => [c.phone, c.id]));
    return phones
      .filter(p => byPhone.has(p))
      .map(phone => ({ id: byPhone.get(phone) as string, phone }));
  },

  async bulkUpsert(
    tenantId: string,
    rows: ContactImportInput[],
  ): Promise<{ created: number; updated: number }> {
    if (rows.length === 0) return { created: 0, updated: 0 };
    const phones = rows.map(r => r.phone);
    const existing = await prisma.contact.findMany({
      where: { tenantId, phone: { in: phones } },
      select: { phone: true },
    });
    const existingPhones = new Set(existing.map(c => c.phone));

    await prisma.$transaction(
      rows.map(row => {
        const update: Prisma.ContactUpdateInput = {};
        if (row.name !== undefined) update.name = row.name;
        if (row.email !== undefined) update.email = row.email;
        if (Object.keys(row.customFields).length > 0) {
          update.customFields = row.customFields as Prisma.InputJsonValue;
        }

        return prisma.contact.upsert({
          where: { tenantId_phone: { tenantId, phone: row.phone } },
          update,
          create: {
            tenantId,
            phone: row.phone,
            name: row.name,
            email: row.email,
            customFields: row.customFields as Prisma.InputJsonValue,
          },
        });
      }),
    );

    const updated = rows.filter(r => existingPhones.has(r.phone)).length;
    return { created: rows.length - updated, updated };
  },
};
