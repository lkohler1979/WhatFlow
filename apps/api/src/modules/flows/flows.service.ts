import { flowsRepository } from './flows.repository.js';
import { AppError, NotFoundError } from '@core/errors.js';
import type { CreateFlowDto, UpdateFlowDto } from './flows.schema.js';
import type { Flow, Prisma } from '@prisma/client';

interface FlowSummary {
  id: string;
  name: string;
  description: string | null;
  status: string;
  version: number;
  triggerType: string;
  triggerValue: string | null;
  instanceId: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
}

function toSummary(f: Flow): FlowSummary {
  return {
    id: f.id,
    name: f.name,
    description: f.description,
    status: f.status,
    version: f.version,
    triggerType: f.triggerType,
    triggerValue: f.triggerValue,
    instanceId: f.instanceId,
    publishedAt: f.publishedAt,
    updatedAt: f.updatedAt,
  };
}

export const flowsService = {
  async list(tenantId: string): Promise<FlowSummary[]> {
    return (await flowsRepository.listByTenant(tenantId)).map(toSummary);
  },

  async get(tenantId: string, id: string): Promise<Flow> {
    const flow = await flowsRepository.findByIdInTenant(id, tenantId);
    if (!flow) throw new NotFoundError('Fluxo');
    return flow;
  },

  async create(tenantId: string, dto: CreateFlowDto): Promise<Flow> {
    return flowsRepository.create({
      tenantId,
      name: dto.name,
      description: dto.description,
      instanceId: dto.instanceId ?? null,
      triggerType: dto.triggerType,
      triggerValue: dto.triggerValue ?? null,
      nodesJson: (dto.nodesJson ?? []) as Prisma.InputJsonValue,
      edgesJson: (dto.edgesJson ?? []) as Prisma.InputJsonValue,
      status: 'DRAFT',
      version: 1,
    });
  },

  /** Atualiza apenas rascunhos — fluxo PUBLICADO é imutável (crie um rascunho via /duplicate). */
  async update(tenantId: string, id: string, dto: UpdateFlowDto): Promise<Flow> {
    const flow = await flowsRepository.findByIdInTenant(id, tenantId);
    if (!flow) throw new NotFoundError('Fluxo');
    if (flow.status === 'PUBLISHED') {
      throw new AppError('Fluxo publicado é imutável; duplique para editar', 409, 'FLOW_IMMUTABLE');
    }
    const data: Prisma.FlowUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.triggerType !== undefined) data.triggerType = dto.triggerType;
    if (dto.triggerValue !== undefined) data.triggerValue = dto.triggerValue;
    if (dto.nodesJson !== undefined) data.nodesJson = dto.nodesJson as Prisma.InputJsonValue;
    if (dto.edgesJson !== undefined) data.edgesJson = dto.edgesJson as Prisma.InputJsonValue;
    await flowsRepository.update(id, tenantId, data);
    return this.get(tenantId, id);
  },

  /** Publica o rascunho (vira versão imutável) e arquiva outros publicados com o mesmo gatilho. */
  async publish(tenantId: string, id: string): Promise<Flow> {
    const flow = await flowsRepository.findByIdInTenant(id, tenantId);
    if (!flow) throw new NotFoundError('Fluxo');
    await flowsRepository.update(id, tenantId, { status: 'PUBLISHED', publishedAt: new Date() });
    await flowsRepository.archivePublishedWithTrigger({
      tenantId,
      instanceId: flow.instanceId,
      triggerType: flow.triggerType,
      triggerValue: flow.triggerValue,
      exceptId: id,
    });
    return this.get(tenantId, id);
  },

  /** Duplica um fluxo como novo RASCUNHO (version+1) — base para editar um publicado. */
  async duplicate(tenantId: string, id: string): Promise<Flow> {
    const flow = await flowsRepository.findByIdInTenant(id, tenantId);
    if (!flow) throw new NotFoundError('Fluxo');
    return flowsRepository.create({
      tenantId,
      name: `${flow.name} (cópia)`,
      description: flow.description,
      instanceId: flow.instanceId,
      triggerType: flow.triggerType,
      triggerValue: flow.triggerValue,
      nodesJson: flow.nodesJson as Prisma.InputJsonValue,
      edgesJson: flow.edgesJson as Prisma.InputJsonValue,
      status: 'DRAFT',
      version: flow.version + 1,
    });
  },

  async remove(tenantId: string, id: string): Promise<void> {
    const flow = await flowsRepository.findByIdInTenant(id, tenantId);
    if (!flow) throw new NotFoundError('Fluxo');
    await flowsRepository.remove(id, tenantId);
  },
};
