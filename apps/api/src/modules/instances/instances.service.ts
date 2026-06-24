import { randomUUID } from 'node:crypto';
import { instancesRepository } from './instances.repository.js';
import { evolutionApiService } from '@integrations/evolution-api/evolution-api.service.js';
import { logger } from '@core/logger.js';
import { NotFoundError } from '@core/errors.js';
import type { CreateInstanceDto } from './instances.schema.js';
import type { Instance, InstanceStatus } from '@prisma/client';

interface InstanceDto {
  id: string;
  name: string;
  phone: string | null;
  status: InstanceStatus;
  qrCode: string | null;
  connectedAt: Date | null;
  createdAt: Date;
}

function toDto(i: Instance): InstanceDto {
  return {
    id: i.id,
    name: i.name,
    phone: i.phone,
    status: i.status,
    qrCode: i.qrCode,
    connectedAt: i.connectedAt,
    createdAt: i.createdAt,
  };
}

/** Normaliza o status retornado pela Evolution (várias formas) → enum interno. */
function mapStatus(evo: unknown): InstanceStatus {
  const e = evo as {
    status?: string;
    state?: string;
    instance?: { state?: string; status?: string };
  };
  const raw = e?.status ?? e?.state ?? e?.instance?.state ?? e?.instance?.status;
  switch (raw) {
    case 'open':
      return 'CONNECTED';
    case 'connecting':
      return 'QR_PENDING';
    case 'close':
      return 'DISCONNECTED';
    default:
      return 'PENDING';
  }
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'inst'
  );
}

export const instancesService = {
  async list(tenantId: string): Promise<InstanceDto[]> {
    const rows = await instancesRepository.listByTenant(tenantId);
    return rows.map(toDto);
  },

  /** Cria a instância na Evolution e persiste no banco. */
  async create(tenantId: string, dto: CreateInstanceDto): Promise<InstanceDto> {
    const evolutionKey = `wf-${slugify(dto.name)}-${randomUUID().slice(0, 8)}`;
    const evo = await evolutionApiService.createInstance(evolutionKey, { qrcode: true });
    const created = await instancesRepository.create({
      tenantId,
      name: dto.name,
      evolutionKey,
      status: mapStatus(evo),
      settings: (dto.settings ?? {}) as object,
    });
    return toDto(created);
  },

  /** Busca a instância e sincroniza o status com a Evolution. */
  async get(tenantId: string, id: string): Promise<InstanceDto> {
    const inst = await instancesRepository.findByIdInTenant(id, tenantId);
    if (!inst) throw new NotFoundError('Instância');
    try {
      const evo = await evolutionApiService.getConnectionState(inst.evolutionKey);
      const status = mapStatus(evo);
      if (status !== inst.status) {
        await instancesRepository.update(id, tenantId, {
          status,
          ...(status === 'CONNECTED' ? { connectedAt: new Date() } : {}),
        });
        inst.status = status;
      }
    } catch (err) {
      logger.warn({ err, id }, 'Falha ao sincronizar status da instância');
    }
    return toDto(inst);
  },

  /** Solicita o QR Code (connect) e atualiza o banco. */
  async getQrCode(
    tenantId: string,
    id: string,
  ): Promise<{ qrCode: string | null; status: InstanceStatus }> {
    const inst = await instancesRepository.findByIdInTenant(id, tenantId);
    if (!inst) throw new NotFoundError('Instância');
    const evo = await evolutionApiService.connect(inst.evolutionKey);
    const e = evo as { base64?: string; qrcode?: { base64?: string } };
    const qrCode = e?.qrcode?.base64 ?? e?.base64 ?? null;
    const status = mapStatus(evo);
    await instancesRepository.update(id, tenantId, {
      qrCode,
      status,
      qrExpiresAt: new Date(Date.now() + 60_000),
    });
    return { qrCode, status };
  },

  /** Remove na Evolution e no banco. */
  async remove(tenantId: string, id: string): Promise<void> {
    const inst = await instancesRepository.findByIdInTenant(id, tenantId);
    if (!inst) throw new NotFoundError('Instância');
    await evolutionApiService
      .deleteInstance(inst.evolutionKey)
      .catch(err => logger.warn({ err, id }, 'Falha ao remover instância na Evolution'));
    await instancesRepository.remove(id, tenantId);
  },
};
