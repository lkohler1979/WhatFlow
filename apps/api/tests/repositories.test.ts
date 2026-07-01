/**
 * Testes das camadas de repositório (acesso a dados). O `prisma` é totalmente
 * mockado — validamos que cada repo monta o `where`/`data`/`orderBy` correto,
 * escopa por tenant e trata os retornos (counts, null, mapeamentos).
 */
import { prisma } from '@core/prisma.js';

type M = jest.Mock;
const model = () => ({
  findMany: jest.fn() as M,
  findFirst: jest.fn() as M,
  findUnique: jest.fn() as M,
  findUniqueOrThrow: jest.fn() as M,
  count: jest.fn() as M,
  create: jest.fn() as M,
  createMany: jest.fn() as M,
  update: jest.fn() as M,
  updateMany: jest.fn() as M,
  deleteMany: jest.fn() as M,
  upsert: jest.fn() as M,
});

jest.mock('@core/prisma.js', () => {
  const m = () => ({
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
    upsert: jest.fn(),
  });
  const client: Record<string, unknown> = {
    tenant: m(),
    user: m(),
    instance: m(),
    flow: m(),
    flowSession: m(),
    contact: m(),
    contactTag: m(),
    conversation: m(),
    conversationTag: m(),
    message: m(),
    campaign: m(),
    campaignContact: m(),
    tag: m(),
    aiConfig: m(),
    webhook: m(),
    webhookDelivery: m(),
    $transaction: jest.fn(),
  };
  return { __esModule: true, prisma: client };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;

beforeEach(() => jest.clearAllMocks());

// ─────────────────────────── auth.repository ───────────────────────────
import { authRepository } from '@modules/auth/auth.repository.js';

describe('authRepository', () => {
  it('createTenantWithOwner cria tenant + owner na transação', async () => {
    const tx = { tenant: model(), user: model() };
    tx.tenant.create.mockResolvedValue({ id: 'tenant-1' });
    tx.user.create.mockResolvedValue({ id: 'u1' });
    p.$transaction.mockImplementation((fn: (t: unknown) => unknown) => fn(tx));

    const r = await authRepository.createTenantWithOwner({
      companyName: 'Empresa',
      slug: 'empresa',
      supabaseUid: 'uid',
      email: 'a@b.com',
      fullName: 'Ana',
    });
    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: 'OWNER' }) }),
    );
    expect(r.tenant.id).toBe('tenant-1');
  });

  it('slugExists true/false conforme count', async () => {
    p.tenant.count.mockResolvedValueOnce(2).mockResolvedValueOnce(0);
    expect(await authRepository.slugExists('x')).toBe(true);
    expect(await authRepository.slugExists('y')).toBe(false);
  });

  it('findUserBySupabaseUid / touchLastLogin / deleteTenant', async () => {
    p.user.findUnique.mockResolvedValue({ id: 'u1' });
    p.user.updateMany.mockResolvedValue({ count: 1 });
    p.tenant.deleteMany.mockResolvedValue({ count: 1 });
    expect(await authRepository.findUserBySupabaseUid('uid')).toEqual({ id: 'u1' });
    await authRepository.touchLastLogin('uid');
    expect(p.user.updateMany).toHaveBeenCalled();
    await authRepository.deleteTenant('t1');
    expect(p.tenant.deleteMany).toHaveBeenCalledWith({ where: { id: 't1' } });
  });
});

// ─────────────────────────── users.repository ───────────────────────────
import { usersRepository } from '@modules/users/users.repository.js';

describe('usersRepository', () => {
  it('listByTenant / findByIdInTenant / findByEmailInTenant', async () => {
    p.user.findMany.mockResolvedValue([{ id: 'u1' }]);
    p.user.findFirst.mockResolvedValue({ id: 'u1' });
    expect(await usersRepository.listByTenant('t1')).toHaveLength(1);
    expect(await usersRepository.findByIdInTenant('u1', 't1')).toEqual({ id: 'u1' });
    expect(await usersRepository.findByEmailInTenant('a@b.com', 't1')).toEqual({ id: 'u1' });
  });

  it('create / updateRole / remove / countByRole', async () => {
    p.user.create.mockResolvedValue({ id: 'u1' });
    p.user.updateMany.mockResolvedValue({ count: 1 });
    p.user.deleteMany.mockResolvedValue({ count: 1 });
    p.user.count.mockResolvedValue(3);
    await usersRepository.create({
      tenantId: 't1',
      supabaseUid: 'uid',
      email: 'a@b.com',
      fullName: 'Ana',
      role: 'AGENT',
    });
    expect(await usersRepository.updateRole('u1', 't1', 'ADMIN')).toBe(1);
    expect(await usersRepository.remove('u1', 't1')).toBe(1);
    expect(await usersRepository.countByRole('t1', 'OWNER')).toBe(3);
  });
});

// ─────────────────────────── instances.repository ───────────────────────────
import { instancesRepository } from '@modules/instances/instances.repository.js';

describe('instancesRepository', () => {
  it('CRUD básico escopado por tenant', async () => {
    p.instance.findMany.mockResolvedValue([{ id: 'i1' }]);
    p.instance.findFirst.mockResolvedValue({ id: 'i1' });
    p.instance.create.mockResolvedValue({ id: 'i1' });
    p.instance.updateMany.mockResolvedValue({ count: 1 });
    p.instance.deleteMany.mockResolvedValue({ count: 1 });
    expect(await instancesRepository.listByTenant('t1')).toHaveLength(1);
    expect(await instancesRepository.findByIdInTenant('i1', 't1')).toEqual({ id: 'i1' });
    await instancesRepository.create({ tenantId: 't1', name: 'X', evolutionKey: 'k' } as never);
    expect(await instancesRepository.update('i1', 't1', {})).toBe(1);
    expect(await instancesRepository.remove('i1', 't1')).toBe(1);
  });

  it('upsertContact / findOrCreateConversationId / createOutboundMessage / touchConversation', async () => {
    p.contact.upsert.mockResolvedValue({ id: 'c1' });
    expect(await instancesRepository.upsertContact('t1', '55')).toBe('c1');

    p.conversation.findFirst.mockResolvedValueOnce({ id: 'cv1' });
    expect(await instancesRepository.findOrCreateConversationId('t1', 'i1', 'c1')).toBe('cv1');
    p.conversation.findFirst.mockResolvedValueOnce(null);
    p.conversation.create.mockResolvedValue({ id: 'cv2' });
    expect(await instancesRepository.findOrCreateConversationId('t1', 'i1', 'c1')).toBe('cv2');

    p.message.create.mockResolvedValue({ id: 'm1' });
    expect(
      (await instancesRepository.createOutboundMessage({ conversationId: 'cv1', content: 'x' })).id,
    ).toBe('m1');

    p.conversation.update.mockResolvedValue({});
    await instancesRepository.touchConversation('cv1', 'preview');
    expect(p.conversation.update).toHaveBeenCalled();
  });
});

// ─────────────────────────── contacts.repository ───────────────────────────
import { contactsRepository } from '@modules/contacts/contacts.repository.js';

describe('contactsRepository', () => {
  it('listByTenant monta where com busca e tag e retorna data/total', async () => {
    p.contact.findMany.mockResolvedValue([{ id: 'c1' }]);
    p.contact.count.mockResolvedValue(1);
    const r = await contactsRepository.listByTenant('t1', {
      search: '5527 99',
      tagId: 'tg1',
      page: 2,
      pageSize: 10,
    });
    expect(r).toEqual({ data: [{ id: 'c1' }], total: 1 });
    const where = p.contact.findMany.mock.calls[0][0].where;
    expect(where.tenantId).toBe('t1');
    expect(where.OR).toBeDefined();
    expect(where.contactTags).toEqual({ some: { tagId: 'tg1' } });
    expect(p.contact.findMany.mock.calls[0][0].skip).toBe(10);
  });

  it('exportByTenant / findByIdInTenant / findByPhoneInTenant / countTagsInTenant', async () => {
    p.contact.findMany.mockResolvedValue([{ id: 'c1' }]);
    p.contact.findFirst.mockResolvedValue({ id: 'c1' });
    p.tag.count.mockResolvedValue(2);
    await contactsRepository.exportByTenant('t1', {});
    expect(await contactsRepository.findByIdInTenant('c1', 't1')).toEqual({ id: 'c1' });
    expect(await contactsRepository.findByPhoneInTenant('55', 't1')).toEqual({ id: 'c1' });
    expect(await contactsRepository.countTagsInTenant('t1', ['a', 'b'])).toBe(2);
    expect(await contactsRepository.countTagsInTenant('t1', [])).toBe(0);
  });

  it('create dentro de transação com tags', async () => {
    const tx = { contact: model(), contactTag: model() };
    tx.contact.create.mockResolvedValue({ id: 'c1' });
    tx.contact.findUniqueOrThrow.mockResolvedValue({ id: 'c1', contactTags: [] });
    p.$transaction.mockImplementation((fn: (t: unknown) => unknown) => fn(tx));
    const r = await contactsRepository.create({ tenantId: 't1', phone: '55' } as never, ['tg1']);
    expect(tx.contactTag.createMany).toHaveBeenCalled();
    expect(r.id).toBe('c1');
  });

  it('update: null quando nada afetado; substitui tags quando informado', async () => {
    const tx = { contact: model(), contactTag: model() };
    tx.contact.updateMany.mockResolvedValueOnce({ count: 0 });
    p.$transaction.mockImplementation((fn: (t: unknown) => unknown) => fn(tx));
    expect(await contactsRepository.update('c1', 't1', {}, [])).toBeNull();

    tx.contact.updateMany.mockResolvedValue({ count: 1 });
    tx.contact.findFirst.mockResolvedValue({ id: 'c1' });
    const r = await contactsRepository.update('c1', 't1', {}, ['tg1']);
    expect(tx.contactTag.deleteMany).toHaveBeenCalled();
    expect(r).toEqual({ id: 'c1' });
  });

  it('remove retorna count', async () => {
    p.contact.deleteMany.mockResolvedValue({ count: 3 });
    expect(await contactsRepository.remove('c1', 't1')).toBe(3);
  });

  it('findOrCreateByPhones cria os faltantes e retorna todos', async () => {
    expect(await contactsRepository.findOrCreateByPhones('t1', [])).toEqual([]);
    p.contact.findMany
      .mockResolvedValueOnce([{ id: 'a', phone: '551' }]) // existentes
      .mockResolvedValueOnce([
        { id: 'a', phone: '551' },
        { id: 'b', phone: '552' },
      ]); // recarregados
    p.contact.createMany.mockResolvedValue({ count: 1 });
    const r = await contactsRepository.findOrCreateByPhones('t1', ['551', '552']);
    expect(p.contact.createMany).toHaveBeenCalled();
    expect(r).toEqual([
      { id: 'a', phone: '551' },
      { id: 'b', phone: '552' },
    ]);
  });

  it('bulkUpsert conta created/updated', async () => {
    expect(await contactsRepository.bulkUpsert('t1', [])).toEqual({ created: 0, updated: 0 });
    p.contact.findMany.mockResolvedValue([{ phone: '551' }]);
    p.$transaction.mockResolvedValue([]);
    const r = await contactsRepository.bulkUpsert('t1', [
      { phone: '551', name: 'A', customFields: {} },
      { phone: '552', email: 'e@e.com', customFields: { k: 'v' } },
    ]);
    expect(r).toEqual({ created: 1, updated: 1 });
  });
});

// ─────────────────────────── conversations.repository ───────────────────────────
import { conversationsRepository } from '@modules/conversations/conversations.repository.js';

describe('conversationsRepository', () => {
  it('listByTenant aplica todos os filtros', async () => {
    p.conversation.findMany.mockResolvedValue([{ id: 'cv1' }]);
    p.conversation.count.mockResolvedValue(1);
    const r = await conversationsRepository.listByTenant('t1', {
      status: 'OPEN' as never,
      instanceId: 'i1',
      assignedToUserId: 'u1',
      contactId: 'c1',
      tagId: 'tg1',
      botActive: true,
      search: 'ana',
      page: 1,
      pageSize: 25,
    });
    expect(r.total).toBe(1);
    const where = p.conversation.findMany.mock.calls[0][0].where;
    expect(where.instanceId).toBe('i1');
    expect(where.assignedTo).toBe('u1');
    expect(where.conversationTags).toEqual({ some: { tagId: 'tg1' } });
    expect(where.contact.OR).toBeDefined();
  });

  it('findByIdInTenant / userBelongsToTenant / update / markRead', async () => {
    p.conversation.findFirst.mockResolvedValue({ id: 'cv1' });
    p.user.count.mockResolvedValue(1);
    p.conversation.updateMany.mockResolvedValue({ count: 1 });
    expect(await conversationsRepository.findByIdInTenant('cv1', 't1')).toEqual({ id: 'cv1' });
    expect(await conversationsRepository.userBelongsToTenant('u1', 't1')).toBe(true);
    expect(await conversationsRepository.update('cv1', 't1', {})).toBe(1);
    expect(await conversationsRepository.markRead('cv1', 't1')).toBe(1);
  });
});

// ─────────────────────────── messages.repository ───────────────────────────
import { messagesRepository } from '@modules/messages/messages.repository.js';

describe('messagesRepository', () => {
  it('conversationBelongsToTenant', async () => {
    p.conversation.count.mockResolvedValue(1);
    expect(await messagesRepository.conversationBelongsToTenant('cv1', 't1')).toBe(true);
  });

  it('listByConversation aplica cursor quando informado', async () => {
    p.message.findMany.mockResolvedValue([]);
    await messagesRepository.listByConversation('cv1', { limit: 30 });
    expect(p.message.findMany.mock.calls[0][0].take).toBe(31);
    await messagesRepository.listByConversation('cv1', { cursor: 'x', limit: 30 });
    expect(p.message.findMany.mock.calls[1][0].cursor).toEqual({ id: 'x' });
  });

  it('getSendContext resolve ou devolve null', async () => {
    p.conversation.findFirst.mockResolvedValueOnce(null);
    expect(await messagesRepository.getSendContext('cv1', 't1')).toBeNull();
    p.conversation.findFirst.mockResolvedValueOnce({
      id: 'cv1',
      instance: { evolutionKey: 'k', status: 'CONNECTED' },
      contact: { phone: '55' },
    });
    expect(await messagesRepository.getSendContext('cv1', 't1')).toEqual({
      id: 'cv1',
      instanceEvolutionKey: 'k',
      instanceStatus: 'CONNECTED',
      contactPhone: '55',
    });
  });

  it('findUserIdBySupabaseUid / createOutboundMessage / createInternalNote / touchConversation', async () => {
    p.user.findFirst.mockResolvedValueOnce({ id: 'u1' }).mockResolvedValueOnce(null);
    expect(await messagesRepository.findUserIdBySupabaseUid('uid', 't1')).toBe('u1');
    expect(await messagesRepository.findUserIdBySupabaseUid('uid', 't1')).toBeNull();
    p.message.create.mockResolvedValue({ id: 'm1' });
    await messagesRepository.createOutboundMessage({ conversationId: 'cv1', content: 'x' });
    await messagesRepository.createInternalNote({ conversationId: 'cv1', content: 'nota' });
    expect(p.message.create.mock.calls[1][0].data.isInternal).toBe(true);
    p.conversation.update.mockResolvedValue({});
    await messagesRepository.touchConversation('cv1', 'x');
    expect(p.conversation.update).toHaveBeenCalled();
  });
});

// ─────────────────────────── tags.repository ───────────────────────────
import { tagsRepository } from '@modules/tags/tags.repository.js';

describe('tagsRepository', () => {
  it('listByTenant com/sem filtro q', async () => {
    p.tag.findMany.mockResolvedValue([{ id: 'tg1' }]);
    await tagsRepository.listByTenant('t1');
    await tagsRepository.listByTenant('t1', 'ab');
    expect(p.tag.findMany.mock.calls[1][0].where.name).toEqual({
      startsWith: 'ab',
      mode: 'insensitive',
    });
  });

  it('CRUD + associações contato/conversa', async () => {
    p.tag.findFirst.mockResolvedValue({ id: 'tg1' });
    p.tag.create.mockResolvedValue({ id: 'tg1' });
    p.tag.updateMany.mockResolvedValue({ count: 1 });
    p.tag.deleteMany.mockResolvedValue({ count: 1 });
    p.contact.findFirst.mockResolvedValue({ id: 'c1' });
    p.conversation.findFirst.mockResolvedValue({ id: 'cv1' });
    p.contactTag.deleteMany.mockResolvedValue({ count: 1 });
    p.conversationTag.deleteMany.mockResolvedValue({ count: 0 });

    expect(await tagsRepository.findByIdInTenant('tg1', 't1')).toEqual({ id: 'tg1' });
    expect(await tagsRepository.findByNameInTenant('vip', 't1')).toEqual({ id: 'tg1' });
    await tagsRepository.create({ tenantId: 't1', name: 'vip', color: '#fff' } as never);
    expect(await tagsRepository.update('tg1', 't1', {})).toBe(1);
    expect(await tagsRepository.remove('tg1', 't1')).toBe(1);
    expect(await tagsRepository.contactBelongsToTenant('c1', 't1')).toEqual({ id: 'c1' });
    await tagsRepository.attachToContact('c1', 'tg1');
    expect(await tagsRepository.detachFromContact('c1', 'tg1')).toBe(1);
    expect(await tagsRepository.conversationBelongsToTenant('cv1', 't1')).toEqual({ id: 'cv1' });
    await tagsRepository.attachToConversation('cv1', 'tg1');
    expect(await tagsRepository.detachFromConversation('cv1', 'tg1')).toBe(0);
  });
});

// ─────────────────────────── flows.repository ───────────────────────────
import { flowsRepository } from '@modules/flows/flows.repository.js';

describe('flowsRepository', () => {
  it('CRUD + archive + findActivePublished', async () => {
    p.flow.findMany.mockResolvedValue([{ id: 'f1' }]);
    p.flow.findFirst.mockResolvedValue({ id: 'f1' });
    p.flow.create.mockResolvedValue({ id: 'f1' });
    p.flow.updateMany.mockResolvedValue({ count: 1 });
    p.flow.deleteMany.mockResolvedValue({ count: 1 });

    expect(await flowsRepository.listByTenant('t1')).toHaveLength(1);
    expect(await flowsRepository.findByIdInTenant('f1', 't1')).toEqual({ id: 'f1' });
    await flowsRepository.create({ tenantId: 't1', name: 'F' } as never);
    expect(await flowsRepository.update('f1', 't1', {})).toBe(1);
    expect(await flowsRepository.remove('f1', 't1')).toBe(1);
    await flowsRepository.archivePublishedWithTrigger({
      tenantId: 't1',
      instanceId: null,
      triggerType: 'KEYWORD' as never,
      triggerValue: 'oi',
      exceptId: 'f1',
    });
    expect(p.flow.updateMany).toHaveBeenCalled();
    await flowsRepository.findActivePublished('t1', 'i1');
    expect(p.flow.findMany.mock.calls[1][0].where.status).toBe('PUBLISHED');
  });
});

// ─────────────────────────── flow-engine.repository ───────────────────────────
import { flowEngineRepository } from '@modules/flow-engine/flow-engine.repository.js';

describe('flowEngineRepository', () => {
  it('sessão: find/create/update', async () => {
    p.flowSession.findFirst.mockResolvedValue({ id: 's1' });
    p.flowSession.create.mockResolvedValue({ id: 's1' });
    p.flowSession.update.mockResolvedValue({});
    expect(await flowEngineRepository.findActiveSession('cv1')).toEqual({ id: 's1' });
    await flowEngineRepository.createSession({
      flowId: 'f1',
      conversationId: 'cv1',
      currentNodeId: 'n1',
      variables: {},
      waitingForInput: false,
      completed: true,
    });
    expect(p.flowSession.create.mock.calls[0][0].data.completedAt).toBeInstanceOf(Date);
    await flowEngineRepository.updateSession('s1', {
      currentNodeId: 'n2',
      variables: {},
      waitingForInput: true,
      completed: false,
    });
    expect(p.flowSession.update.mock.calls[0][0].data.completedAt).toBeNull();
  });

  it('loadHistory filtra conteúdo nulo e inverte a ordem', async () => {
    p.message.findMany.mockResolvedValue([
      { direction: 'OUTBOUND', content: 'b' },
      { direction: 'INBOUND', content: 'a' },
    ]);
    const r = await flowEngineRepository.loadHistory('cv1', 5);
    expect(r).toEqual([
      { direction: 'INBOUND', content: 'a' },
      { direction: 'OUTBOUND', content: 'b' },
    ]);
  });

  it('createOutboundMessage / touchConversation / setBotActive', async () => {
    p.message.create.mockResolvedValue({ id: 'm1' });
    p.conversation.update.mockResolvedValue({});
    expect((await flowEngineRepository.createOutboundMessage('cv1', 'x')).id).toBe('m1');
    await flowEngineRepository.touchConversation('cv1', 'x');
    await flowEngineRepository.setBotActive('cv1', false);
    expect(p.conversation.update).toHaveBeenCalledTimes(2);
  });
});

// ─────────────────────────── campaigns.repository ───────────────────────────
import { campaignsRepository } from '@modules/campaigns/campaigns.repository.js';

describe('campaignsRepository', () => {
  it('listByTenant com status + createWithContacts', async () => {
    p.campaign.findMany.mockResolvedValue([{ id: 'cp1' }]);
    p.campaign.count.mockResolvedValue(1);
    p.campaign.create.mockResolvedValue({ id: 'cp1' });
    const r = await campaignsRepository.listByTenant('t1', {
      status: 'DRAFT' as never,
      page: 1,
      pageSize: 10,
    });
    expect(r.total).toBe(1);
    await campaignsRepository.createWithContacts({ tenantId: 't1', name: 'C' } as never, [
      { contactId: 'c1', phone: '55' },
    ]);
    expect(p.campaign.create.mock.calls[0][0].data.totalContacts).toBe(1);
  });

  it('findByIdInTenant / instanceBelongsToTenant / resolveContacts / update / updateStatus / remove', async () => {
    p.campaign.findFirst.mockResolvedValue({ id: 'cp1' });
    p.instance.count.mockResolvedValue(1);
    p.contact.findMany.mockResolvedValue([{ id: 'c1', phone: '55' }]);
    p.campaign.updateMany.mockResolvedValue({ count: 1 });
    p.campaign.deleteMany.mockResolvedValue({ count: 1 });
    expect(await campaignsRepository.findByIdInTenant('cp1', 't1')).toEqual({ id: 'cp1' });
    expect(await campaignsRepository.instanceBelongsToTenant('i1', 't1')).toBe(true);
    expect(await campaignsRepository.resolveContacts('t1', ['c1'])).toHaveLength(1);
    expect(await campaignsRepository.update('cp1', 't1', {})).toBe(1);
    expect(await campaignsRepository.updateStatus('cp1', 't1', 'RUNNING' as never)).toBe(1);
    expect(await campaignsRepository.remove('cp1', 't1')).toBe(1);
  });

  it('suporte ao processor: evolutionKey/status/pending/contadores/mensagem', async () => {
    p.campaign.findFirst
      .mockResolvedValueOnce({ instance: { evolutionKey: 'k' } })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ status: 'RUNNING' })
      .mockResolvedValueOnce(null);
    expect(await campaignsRepository.getEvolutionKeyForCampaign('cp1', 't1')).toBe('k');
    expect(await campaignsRepository.getEvolutionKeyForCampaign('cp1', 't1')).toBeNull();
    expect(await campaignsRepository.getStatus('cp1', 't1')).toBe('RUNNING');
    expect(await campaignsRepository.getStatus('cp1', 't1')).toBeNull();

    p.campaignContact.findMany.mockResolvedValue([{ id: 'cc1', phone: '55', contactId: 'c1' }]);
    expect(await campaignsRepository.pendingContacts('cp1')).toHaveLength(1);

    p.campaignContact.update.mockResolvedValue({});
    await campaignsRepository.updateContactStatus('cc1', 'SENT', { externalId: 'e1' });
    await campaignsRepository.updateContactStatus('cc2', 'FAILED', { errorMessage: 'x' });
    expect(p.campaignContact.update).toHaveBeenCalledTimes(2);

    p.campaign.updateMany.mockResolvedValue({ count: 1 });
    await campaignsRepository.incrementCounters('cp1', 't1', { sent: 2, failed: 1 });
    expect(p.campaign.updateMany).toHaveBeenCalled();

    p.conversation.findFirst.mockResolvedValueOnce(null);
    p.conversation.create.mockResolvedValue({ id: 'cv1' });
    p.message.create.mockResolvedValue({ id: 'm1' });
    await campaignsRepository.recordOutboundMessage({
      tenantId: 't1',
      instanceId: 'i1',
      contactId: 'c1',
      content: 'oi',
      externalId: 'e1',
    });
    expect(p.message.create).toHaveBeenCalled();
  });
});

// ─────────────────────────── ai.repository ───────────────────────────
import { aiRepository } from '@modules/ai/ai.repository.js';

describe('aiRepository', () => {
  it('findByTenant / create / update (com e sem match)', async () => {
    p.aiConfig.findFirst.mockResolvedValue({ id: 'a1' });
    p.aiConfig.create.mockResolvedValue({ id: 'a1' });
    p.aiConfig.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });

    expect(await aiRepository.findByTenant('t1')).toEqual({ id: 'a1' });
    await aiRepository.create('t1', { provider: 'groq' } as never);
    expect(p.aiConfig.create.mock.calls[0][0].data.tenantId).toBe('t1');
    expect(await aiRepository.update('a1', 't1', {})).toBeNull();
    expect(await aiRepository.update('a1', 't1', {})).toEqual({ id: 'a1' });
  });
});

// ─────────────────────────── webhooks.repository ───────────────────────────
import { webhooksRepository } from '@modules/webhooks/webhooks.repository.js';

describe('webhooksRepository', () => {
  it('CRUD + subscribers + deliveries', async () => {
    p.webhook.findMany.mockResolvedValue([{ id: 'w1' }]);
    p.webhook.count.mockResolvedValue(1);
    p.webhook.findFirst.mockResolvedValue({ id: 'w1' });
    p.webhook.create.mockResolvedValue({ id: 'w1' });
    p.webhook.updateMany.mockResolvedValue({ count: 1 });
    p.webhook.deleteMany.mockResolvedValue({ count: 1 });
    p.webhookDelivery.findMany.mockResolvedValue([{ id: 'd1' }]);
    p.webhookDelivery.count.mockResolvedValue(1);
    p.webhookDelivery.create.mockResolvedValue({ id: 'd1' });
    p.webhookDelivery.update.mockResolvedValue({});

    expect((await webhooksRepository.listByTenant('t1', { page: 1, pageSize: 10 })).total).toBe(1);
    expect(await webhooksRepository.findByIdInTenant('w1', 't1')).toEqual({ id: 'w1' });
    await webhooksRepository.create({ tenantId: 't1', url: 'http://x' } as never);
    expect(await webhooksRepository.update('w1', 't1', {})).toBe(1);
    expect(await webhooksRepository.remove('w1', 't1')).toBe(1);
    await webhooksRepository.findActiveSubscribers('t1', 'MESSAGE_RECEIVED' as never);
    expect(
      (await webhooksRepository.listDeliveries('w1', {
        status: 'PENDING' as never,
        page: 1,
        pageSize: 10,
      })).total,
    ).toBe(1);
    await webhooksRepository.createDelivery({ webhookId: 'w1' } as never);
    await webhooksRepository.updateDelivery('d1', {});
    expect(p.webhookDelivery.update).toHaveBeenCalled();
  });
});

// ─────────────────────────── webhook-receiver.repository ───────────────────────────
import { webhookReceiverRepository } from '@modules/webhook-receiver/webhook-receiver.repository.js';

describe('webhookReceiverRepository', () => {
  it('findInstanceByKey / updateInstanceStatus / updateInstanceQr', async () => {
    p.instance.findFirst.mockResolvedValue({ id: 'i1' });
    p.instance.update.mockResolvedValue({});
    expect(await webhookReceiverRepository.findInstanceByKey('k')).toEqual({ id: 'i1' });
    await webhookReceiverRepository.updateInstanceStatus('i1', 'CONNECTED', { phone: '55' });
    expect(p.instance.update.mock.calls[0][0].data.connectedAt).toBeInstanceOf(Date);
    await webhookReceiverRepository.updateInstanceStatus('i1', 'DISCONNECTED');
    expect(p.instance.update.mock.calls[1][0].data.disconnectedAt).toBeInstanceOf(Date);
    await webhookReceiverRepository.updateInstanceQr('i1', 'qr');
    expect(p.instance.update.mock.calls[2][0].data.status).toBe('QR_PENDING');
  });

  it('upsertContact / findOrCreateConversation / createInboundMessage / touchConversation', async () => {
    p.contact.upsert.mockResolvedValue({ id: 'c1' });
    expect(await webhookReceiverRepository.upsertContact('t1', '55', 'Ana')).toBe('c1');
    p.conversation.findFirst.mockResolvedValueOnce({ id: 'cv1' });
    expect(await webhookReceiverRepository.findOrCreateConversation('t1', 'i1', 'c1')).toEqual({
      id: 'cv1',
    });
    p.conversation.findFirst.mockResolvedValueOnce(null);
    p.conversation.create.mockResolvedValue({ id: 'cv2' });
    expect(await webhookReceiverRepository.findOrCreateConversation('t1', 'i1', 'c1')).toEqual({
      id: 'cv2',
    });
    p.message.create.mockResolvedValue({ id: 'm1' });
    await webhookReceiverRepository.createInboundMessage({ conversationId: 'cv1', content: 'oi' });
    p.conversation.update.mockResolvedValue({});
    await webhookReceiverRepository.touchConversation('cv1', 'oi');
    expect(p.conversation.update.mock.calls[0][0].data.unreadCount).toEqual({ increment: 1 });
  });

  it('updateMessageStatusByExternalId mapeia acks e ignora desconhecidos', async () => {
    p.message.updateMany.mockResolvedValue({ count: 1 });
    await webhookReceiverRepository.updateMessageStatusByExternalId('e1', 'DELIVERY_ACK');
    expect(p.message.updateMany.mock.calls[0][0].data.status).toBe('DELIVERED');
    await webhookReceiverRepository.updateMessageStatusByExternalId('e1', 'UNKNOWN');
    expect(p.message.updateMany).toHaveBeenCalledTimes(1);
  });
});
