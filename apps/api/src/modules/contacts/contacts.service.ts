import { AppError, ConflictError, NotFoundError, ValidationError } from '@core/errors.js';
import { contactsRepository, type ContactWithTags } from './contacts.repository.js';
import type {
  CreateContactDto,
  ImportContactsDto,
  ListContactsQuery,
  UpdateContactDto,
} from './contacts.schema.js';
import { isValidPhone, normalizePhone } from './contacts.schema.js';
import type { Prisma } from '@prisma/client';

interface ContactDto {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  customFields: unknown;
  isBlocked: boolean;
  isOptedOut: boolean;
  optedOutAt: Date | null;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  tags: { id: string; name: string; color: string }[];
}

interface ImportError {
  line: number;
  message: string;
}

interface ImportRow {
  line: number;
  phone: string;
  name?: string;
  email?: string;
  customFields: Record<string, unknown>;
}

function toDto(c: ContactWithTags): ContactDto {
  return {
    id: c.id,
    phone: c.phone,
    name: c.name,
    email: c.email,
    customFields: c.customFields,
    isBlocked: c.isBlocked,
    isOptedOut: c.isOptedOut,
    optedOutAt: c.optedOutAt,
    lastSeenAt: c.lastSeenAt,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    tags: c.contactTags.map(ct => ({
      id: ct.tag.id,
      name: ct.tag.name,
      color: ct.tag.color,
    })),
  };
}

function unique(ids: string[]): string[] {
  return [...new Set(ids)];
}

interface PhoneValidation {
  valid: string[];
  total: number;
  invalid: number;
  duplicates: number;
}

/** Normaliza, valida e deduplica uma lista de telefones brutos (reusa T-041). */
function validatePhoneList(phones: string[]): PhoneValidation {
  const seen = new Set<string>();
  const valid: string[] = [];
  let invalid = 0;
  let duplicates = 0;

  for (const raw of phones) {
    const phone = normalizePhone(raw ?? '');
    if (!isValidPhone(phone)) {
      invalid += 1;
      continue;
    }
    if (seen.has(phone)) {
      duplicates += 1;
      continue;
    }
    seen.add(phone);
    valid.push(phone);
  }

  return { valid, total: phones.length, invalid, duplicates };
}

async function assertTags(tenantId: string, tagIds: string[]): Promise<string[]> {
  const ids = unique(tagIds);
  if (ids.length === 0) return ids;
  const count = await contactsRepository.countTagsInTenant(tenantId, ids);
  if (count !== ids.length) {
    throw new NotFoundError('Tag');
  }
  return ids;
}

function csvDelimiter(header: string): string {
  const comma = (header.match(/,/g) ?? []).length;
  const semicolon = (header.match(/;/g) ?? []).length;
  return semicolon > comma ? ';' : ',';
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = '';
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (ch === '"') {
      quoted = !quoted;
      continue;
    }
    if (ch === delimiter && !quoted) {
      values.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  values.push(current.trim());
  return values;
}

function findHeader(headers: string[], candidates: string[]): number {
  return headers.findIndex(h => candidates.includes(h));
}

function parseCsv(csv: string): { rows: ImportRow[]; errors: ImportError[] } {
  const lines = csv
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter(line => line.trim().length > 0);
  if (lines.length < 2)
    throw new ValidationError('CSV precisa conter cabeçalho e ao menos uma linha');

  const delimiter = csvDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter).map(h => h.trim().toLowerCase());
  const phoneIndex = findHeader(headers, ['phone', 'telefone', 'numero', 'número', 'whatsapp']);
  if (phoneIndex === -1) {
    throw new ValidationError('CSV precisa conter uma coluna phone/telefone/numero');
  }
  const nameIndex = findHeader(headers, ['name', 'nome']);
  const emailIndex = findHeader(headers, ['email', 'e-mail']);

  const rows: ImportRow[] = [];
  const errors: ImportError[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < lines.length; i += 1) {
    const lineNo = i + 1;
    const values = parseCsvLine(lines[i], delimiter);
    const phone = normalizePhone(values[phoneIndex] ?? '');
    if (!isValidPhone(phone)) {
      errors.push({ line: lineNo, message: 'Telefone inválido' });
      continue;
    }
    if (seen.has(phone)) {
      errors.push({ line: lineNo, message: 'Telefone duplicado no CSV' });
      continue;
    }
    seen.add(phone);

    const email = emailIndex >= 0 ? values[emailIndex]?.trim() : undefined;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ line: lineNo, message: 'E-mail inválido' });
      continue;
    }

    const customFields: Record<string, unknown> = {};
    headers.forEach((header, idx) => {
      if (!header || idx === phoneIndex || idx === nameIndex || idx === emailIndex) return;
      const value = values[idx]?.trim();
      if (value) customFields[header] = value;
    });

    rows.push({
      line: lineNo,
      phone,
      name: nameIndex >= 0 ? values[nameIndex]?.trim() || undefined : undefined,
      email: email || undefined,
      customFields,
    });
  }

  return { rows, errors };
}

function csvEscape(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  if (!/[",\n\r;]/.test(raw)) return raw;
  return `"${raw.replace(/"/g, '""')}"`;
}

function exportCsv(rows: ContactDto[]): string {
  const header = [
    'phone',
    'name',
    'email',
    'isBlocked',
    'isOptedOut',
    'tags',
    'createdAt',
    'updatedAt',
  ];
  const body = rows.map(c =>
    [
      c.phone,
      c.name,
      c.email,
      c.isBlocked,
      c.isOptedOut,
      c.tags.map(t => t.name).join('|'),
      c.createdAt.toISOString(),
      c.updatedAt.toISOString(),
    ]
      .map(csvEscape)
      .join(','),
  );
  return [header.join(','), ...body].join('\n');
}

export const contactsService = {
  async list(
    tenantId: string,
    query: ListContactsQuery,
  ): Promise<{ data: ContactDto[]; total: number; page: number; pageSize: number }> {
    const { data, total } = await contactsRepository.listByTenant(tenantId, query);
    return { data: data.map(toDto), total, page: query.page, pageSize: query.pageSize };
  },

  async get(tenantId: string, id: string): Promise<ContactDto> {
    const contact = await contactsRepository.findByIdInTenant(id, tenantId);
    if (!contact) throw new NotFoundError('Contato');
    return toDto(contact);
  },

  async create(tenantId: string, dto: CreateContactDto): Promise<ContactDto> {
    const existing = await contactsRepository.findByPhoneInTenant(dto.phone, tenantId);
    if (existing) throw new ConflictError('Já existe um contato com este telefone');
    const tagIds = await assertTags(tenantId, dto.tagIds);
    const contact = await contactsRepository.create(
      {
        tenantId,
        phone: dto.phone,
        name: dto.name ?? null,
        email: dto.email ?? null,
        customFields: dto.customFields as Prisma.InputJsonValue,
        isBlocked: dto.isBlocked,
        isOptedOut: dto.isOptedOut,
        optedOutAt: dto.isOptedOut ? new Date() : null,
      },
      tagIds,
    );
    return toDto(contact);
  },

  async update(tenantId: string, id: string, dto: UpdateContactDto): Promise<ContactDto> {
    const existing = await contactsRepository.findByIdInTenant(id, tenantId);
    if (!existing) throw new NotFoundError('Contato');

    if (dto.phone && dto.phone !== existing.phone) {
      const byPhone = await contactsRepository.findByPhoneInTenant(dto.phone, tenantId);
      if (byPhone && byPhone.id !== id) {
        throw new ConflictError('Já existe um contato com este telefone');
      }
    }

    const data: Prisma.ContactUpdateInput = {};
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.customFields !== undefined)
      data.customFields = dto.customFields as Prisma.InputJsonValue;
    if (dto.isBlocked !== undefined) data.isBlocked = dto.isBlocked;
    if (dto.isOptedOut !== undefined) {
      data.isOptedOut = dto.isOptedOut;
      data.optedOutAt = dto.isOptedOut ? (existing.optedOutAt ?? new Date()) : null;
    }

    const tagIds = dto.tagIds ? await assertTags(tenantId, dto.tagIds) : undefined;
    const updated = await contactsRepository.update(id, tenantId, data, tagIds);
    if (!updated) throw new NotFoundError('Contato');
    return toDto(updated);
  },

  async remove(tenantId: string, id: string): Promise<void> {
    const removed = await contactsRepository.remove(id, tenantId);
    if (removed === 0) throw new NotFoundError('Contato');
  },

  async importCsv(
    tenantId: string,
    dto: ImportContactsDto,
  ): Promise<{
    total: number;
    imported: number;
    created: number;
    updated: number;
    failed: number;
    errors: ImportError[];
  }> {
    const { rows, errors } = parseCsv(dto.csv);
    if (rows.length === 0 && errors.length > 0) {
      throw new AppError('Nenhuma linha válida para importar', 422, 'NO_VALID_CONTACTS');
    }
    const result = await contactsRepository.bulkUpsert(tenantId, rows);
    return {
      total: rows.length + errors.length,
      imported: result.created + result.updated,
      created: result.created,
      updated: result.updated,
      failed: errors.length,
      errors: errors.slice(0, 50),
    };
  },

  /**
   * Find-or-create em lote de contatos a partir de uma lista de telefones
   * (brutos). Normaliza, valida (reusando isValidPhone/normalizePhone do
   * T-041), deduplica e cria os que faltam num único lote. Usado pela
   * montagem de lista de campanha via CSV (T-035).
   *
   * Retorna os contatos resolvidos e um resumo de inválidos/duplicados para
   * conferência. Não lança quando há inválidos — o chamador decide.
   */
  async bulkUpsertByPhones(
    tenantId: string,
    phones: string[],
  ): Promise<{
    contacts: { id: string; phone: string }[];
    total: number;
    valid: number;
    invalid: number;
    duplicates: number;
  }> {
    const { valid, total, invalid, duplicates } = validatePhoneList(phones);
    const contacts = await contactsRepository.findOrCreateByPhones(tenantId, valid);
    return { contacts, total, valid: valid.length, invalid, duplicates };
  },

  /**
   * Preview puro (sem escrita) de uma lista de telefones — total, válidos,
   * inválidos e duplicados. Usado pelo wizard de campanha (T-035) para
   * sinalizar números fora do padrão antes de confirmar.
   */
  validatePhones(phones: string[]): {
    total: number;
    valid: number;
    invalid: number;
    duplicates: number;
  } {
    const r = validatePhoneList(phones);
    return { total: r.total, valid: r.valid.length, invalid: r.invalid, duplicates: r.duplicates };
  },

  async export(tenantId: string, query: ListContactsQuery): Promise<string> {
    const rows = await contactsRepository.exportByTenant(tenantId, query);
    return exportCsv(rows.map(toDto));
  },
};
