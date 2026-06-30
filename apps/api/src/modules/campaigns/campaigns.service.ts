import { campaignsRepository } from './campaigns.repository.js';
import { contactsService } from '@modules/contacts/contacts.service.js';
import { AppError, NotFoundError } from '@core/errors.js';
import { logger } from '@core/logger.js';
import { addJob, campaignQueue } from '@queues/index.js';
import type {
  CreateCampaignDto,
  UpdateCampaignDto,
  ListCampaignsQuery,
} from './campaigns.schema.js';
import type { Campaign, CampaignStatus, Prisma } from '@prisma/client';

/** Estados terminais — campanha não pode mais transicionar. */
const TERMINAL: CampaignStatus[] = ['COMPLETED', 'CANCELLED', 'FAILED'];
/** Estados a partir dos quais é possível (re)iniciar. */
const STARTABLE: CampaignStatus[] = ['DRAFT', 'SCHEDULED', 'PAUSED'];
/** Estados editáveis (update/delete só fazem sentido antes de rodar). */
const EDITABLE: CampaignStatus[] = ['DRAFT', 'SCHEDULED'];

interface CampaignSummary {
  id: string;
  name: string;
  status: CampaignStatus;
  instanceId: string;
  messageType: string;
  scheduledAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  totalContacts: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  createdAt: Date;
  updatedAt: Date;
}

function toSummary(c: Campaign): CampaignSummary {
  return {
    id: c.id,
    name: c.name,
    status: c.status,
    instanceId: c.instanceId,
    messageType: c.messageType,
    scheduledAt: c.scheduledAt,
    startedAt: c.startedAt,
    completedAt: c.completedAt,
    totalContacts: c.totalContacts,
    sentCount: c.sentCount,
    deliveredCount: c.deliveredCount,
    failedCount: c.failedCount,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export const campaignsService = {
  async list(
    tenantId: string,
    query: ListCampaignsQuery,
  ): Promise<{ data: CampaignSummary[]; total: number; page: number; pageSize: number }> {
    const { data, total } = await campaignsRepository.listByTenant(tenantId, {
      status: query.status,
      page: query.page,
      pageSize: query.pageSize,
    });
    return { data: data.map(toSummary), total, page: query.page, pageSize: query.pageSize };
  },

  async get(tenantId: string, id: string): Promise<Campaign> {
    const campaign = await campaignsRepository.findByIdInTenant(id, tenantId);
    if (!campaign) throw new NotFoundError('Campanha');
    return campaign;
  },

  async create(tenantId: string, dto: CreateCampaignDto): Promise<Campaign> {
    const okInstance = await campaignsRepository.instanceBelongsToTenant(dto.instanceId, tenantId);
    if (!okInstance) throw new NotFoundError('Instância');

    // Contatos podem vir por IDs já cadastrados e/ou por telefones de um CSV
    // (T-035). Os telefones são resolvidos via find-or-create no tenant.
    const byIds = dto.contactIds.length
      ? await campaignsRepository.resolveContacts(tenantId, dto.contactIds)
      : [];
    const byPhones = dto.phones.length
      ? (await contactsService.bulkUpsertByPhones(tenantId, dto.phones)).contacts
      : [];

    // Dedupe por contactId (um telefone do CSV pode já estar entre os IDs).
    const dedup = new Map<string, { id: string; phone: string }>();
    for (const c of [...byIds, ...byPhones]) dedup.set(c.id, c);
    const contacts = [...dedup.values()];

    if (contacts.length === 0) {
      throw new AppError('Nenhum contato válido para a campanha', 422, 'NO_VALID_CONTACTS');
    }

    // Agendamento futuro nasce SCHEDULED; caso contrário DRAFT.
    const status: CampaignStatus =
      dto.scheduledAt && dto.scheduledAt.getTime() > Date.now() ? 'SCHEDULED' : 'DRAFT';

    return campaignsRepository.createWithContacts(
      {
        tenantId,
        instanceId: dto.instanceId,
        name: dto.name,
        description: dto.description ?? null,
        status,
        messageType: dto.messageType,
        messageContent: dto.messageContent ?? null,
        mediaUrl: dto.mediaUrl ?? null,
        mediaCaption: dto.mediaCaption ?? null,
        scheduledAt: dto.scheduledAt ?? null,
        delayMinMs: dto.delayMinMs,
        delayMaxMs: dto.delayMaxMs,
      },
      contacts.map(c => ({ contactId: c.id, phone: c.phone })),
    );
  },

  /** Atualiza campos da campanha — só permitido em DRAFT/SCHEDULED. */
  async update(tenantId: string, id: string, dto: UpdateCampaignDto): Promise<Campaign> {
    const campaign = await this.get(tenantId, id);
    if (!EDITABLE.includes(campaign.status)) {
      throw new AppError(
        'Campanha só pode ser editada em rascunho ou agendada',
        409,
        'INVALID_CAMPAIGN_STATE',
      );
    }
    const data: Prisma.CampaignUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.messageType !== undefined) data.messageType = dto.messageType;
    if (dto.messageContent !== undefined) data.messageContent = dto.messageContent;
    if (dto.mediaUrl !== undefined) data.mediaUrl = dto.mediaUrl;
    if (dto.mediaCaption !== undefined) data.mediaCaption = dto.mediaCaption;
    if (dto.scheduledAt !== undefined) data.scheduledAt = dto.scheduledAt;
    if (dto.delayMinMs !== undefined) data.delayMinMs = dto.delayMinMs;
    if (dto.delayMaxMs !== undefined) data.delayMaxMs = dto.delayMaxMs;
    await campaignsRepository.update(id, tenantId, data);
    return this.get(tenantId, id);
  },

  /** Inicia o disparo (→RUNNING). Válido só de DRAFT/SCHEDULED/PAUSED. */
  async start(tenantId: string, id: string): Promise<Campaign> {
    const campaign = await this.get(tenantId, id);
    if (!STARTABLE.includes(campaign.status)) {
      throw new AppError(
        `Não é possível iniciar uma campanha em estado ${campaign.status}`,
        409,
        'INVALID_CAMPAIGN_STATE',
      );
    }
    await campaignsRepository.updateStatus(id, tenantId, 'RUNNING', {
      startedAt: campaign.startedAt ?? new Date(),
    });

    // Gancho para a fila de disparo (T-033). O processador real fará o envio
    // contato a contato respeitando os delays anti-ban; aqui só enfileiramos o
    // trigger da campanha. Falha ao enfileirar não derruba a transição de estado.
    try {
      await addJob(campaignQueue, 'campaign:start', { campaignId: id, tenantId });
    } catch (err) {
      logger.error({ tenantId, campaignId: id, err }, 'Falha ao enfileirar disparo da campanha');
    }

    return this.get(tenantId, id);
  },

  /** Pausa o disparo (→PAUSED). Válido só de RUNNING. */
  async pause(tenantId: string, id: string): Promise<Campaign> {
    const campaign = await this.get(tenantId, id);
    if (campaign.status !== 'RUNNING') {
      throw new AppError(
        `Só é possível pausar uma campanha em execução (estado atual: ${campaign.status})`,
        409,
        'INVALID_CAMPAIGN_STATE',
      );
    }
    await campaignsRepository.updateStatus(id, tenantId, 'PAUSED');
    return this.get(tenantId, id);
  },

  /** Cancela a campanha (→CANCELLED). Válido de qualquer estado não-terminal. */
  async cancel(tenantId: string, id: string): Promise<Campaign> {
    const campaign = await this.get(tenantId, id);
    if (TERMINAL.includes(campaign.status)) {
      throw new AppError(
        `Campanha em estado ${campaign.status} não pode ser cancelada`,
        409,
        'INVALID_CAMPAIGN_STATE',
      );
    }
    await campaignsRepository.updateStatus(id, tenantId, 'CANCELLED', { completedAt: new Date() });
    return this.get(tenantId, id);
  },

  /** Remove a campanha — só DRAFT/SCHEDULED (campanha já disparada fica no histórico). */
  async remove(tenantId: string, id: string): Promise<void> {
    const campaign = await this.get(tenantId, id);
    if (!EDITABLE.includes(campaign.status)) {
      throw new AppError(
        'Só é possível remover campanhas em rascunho ou agendadas',
        409,
        'INVALID_CAMPAIGN_STATE',
      );
    }
    await campaignsRepository.remove(id, tenantId);
  },
};
