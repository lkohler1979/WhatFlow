/**
 * Testes dos controllers (camada fina HTTP). Cada service é mockado; validamos
 * status code, corpo devolvido e o repasse correto de tenantId/params/body.
 */
import type { Request, Response } from 'express';

jest.mock('@modules/auth/auth.service.js');
jest.mock('@modules/users/users.service.js');
jest.mock('@modules/instances/instances.service.js');
jest.mock('@modules/contacts/contacts.service.js');
jest.mock('@modules/campaigns/campaigns.service.js');
jest.mock('@modules/conversations/conversations.service.js');
jest.mock('@modules/messages/messages.service.js');
jest.mock('@modules/flows/flows.service.js');
jest.mock('@modules/tags/tags.service.js');
jest.mock('@modules/webhooks/webhooks.service.js');
jest.mock('@modules/webhook-receiver/webhook-receiver.service.js');
jest.mock('@modules/analytics/analytics.service.js');
jest.mock('@modules/analytics/analytics-export.service.js');
jest.mock('@modules/ai/ai.service.js');

import { authController } from '@modules/auth/auth.controller.js';
import { authService } from '@modules/auth/auth.service.js';
import { usersController } from '@modules/users/users.controller.js';
import { usersService } from '@modules/users/users.service.js';
import { instancesController } from '@modules/instances/instances.controller.js';
import { instancesService } from '@modules/instances/instances.service.js';
import { contactsController } from '@modules/contacts/contacts.controller.js';
import { contactsService } from '@modules/contacts/contacts.service.js';
import { campaignsController } from '@modules/campaigns/campaigns.controller.js';
import { campaignsService } from '@modules/campaigns/campaigns.service.js';
import { conversationsController } from '@modules/conversations/conversations.controller.js';
import { conversationsService } from '@modules/conversations/conversations.service.js';
import { messagesController } from '@modules/messages/messages.controller.js';
import { messagesService } from '@modules/messages/messages.service.js';
import { flowsController } from '@modules/flows/flows.controller.js';
import { flowsService } from '@modules/flows/flows.service.js';
import { tagsController } from '@modules/tags/tags.controller.js';
import { tagsService } from '@modules/tags/tags.service.js';
import { webhooksController } from '@modules/webhooks/webhooks.controller.js';
import { webhooksService } from '@modules/webhooks/webhooks.service.js';
import { webhookReceiverController } from '@modules/webhook-receiver/webhook-receiver.controller.js';
import { webhookReceiverService } from '@modules/webhook-receiver/webhook-receiver.service.js';
import { analyticsController } from '@modules/analytics/analytics.controller.js';
import { analyticsService } from '@modules/analytics/analytics.service.js';
import { analyticsExportService } from '@modules/analytics/analytics-export.service.js';
import { aiController } from '@modules/ai/ai.controller.js';
import { aiConfigService } from '@modules/ai/ai.service.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anySvc = (s: unknown) => s as any;

function ctx(over: Partial<Request> = {}) {
  const res = {} as Response & { body?: unknown; statusCode?: number; headers: Record<string, string> };
  res.headers = {};
  res.status = jest.fn().mockImplementation((c: number) => {
    res.statusCode = c;
    return res;
  }) as never;
  res.json = jest.fn().mockImplementation((b: unknown) => {
    res.body = b;
    return res;
  }) as never;
  res.send = jest.fn().mockImplementation((b?: unknown) => {
    res.body = b;
    return res;
  }) as never;
  res.header = jest.fn().mockImplementation((k: string, v: string) => {
    res.headers[k] = v;
    return res;
  }) as never;
  const req = {
    tenantId: 't1',
    params: {},
    query: {},
    body: {},
    headers: {},
    user: { sub: 'uid-1' },
    ...over,
  } as unknown as Request;
  return { req, res };
}

beforeEach(() => jest.clearAllMocks());

describe('authController', () => {
  it('register → 201', async () => {
    anySvc(authService).register.mockResolvedValue({ ok: true });
    const { req, res } = ctx({ body: { email: 'a@b.com' } as never });
    await authController.register(req, res);
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ ok: true });
  });
  it('login → 200', async () => {
    anySvc(authService).login.mockResolvedValue({ user: {} });
    const { req, res } = ctx();
    await authController.login(req, res);
    expect(res.statusCode).toBe(200);
  });
  it('refresh → 200 envelope session', async () => {
    anySvc(authService).refresh.mockResolvedValue({ accessToken: 'x' });
    const { req, res } = ctx();
    await authController.refresh(req, res);
    expect(res.body).toEqual({ session: { accessToken: 'x' } });
  });
  it('forgotPassword → 204', async () => {
    anySvc(authService).requestPasswordReset.mockResolvedValue(undefined);
    const { req, res } = ctx();
    await authController.forgotPassword(req, res);
    expect(res.statusCode).toBe(204);
  });
  it('logout extrai bearer e responde 204', async () => {
    anySvc(authService).logout.mockResolvedValue(undefined);
    const { req, res } = ctx({ headers: { authorization: 'Bearer tkn' } as never });
    await authController.logout(req, res);
    expect(anySvc(authService).logout).toHaveBeenCalledWith('tkn');
    expect(res.statusCode).toBe(204);
  });
  it('me devolve usuário + tenant completos (P-11)', async () => {
    const meResult = {
      id: 'uid-1',
      tenantId: 't1',
      role: 'OWNER',
      user: { id: 'uid-1', email: 'a@b.com', fullName: 'A B' },
      tenant: { id: 't1', name: 'Acme', slug: 'acme' },
    };
    anySvc(authService).me.mockResolvedValue(meResult);
    const { req, res } = ctx();
    await authController.me(req, res);
    expect(anySvc(authService).me).toHaveBeenCalledWith('uid-1');
    expect(res.body).toEqual(meResult);
  });
});

describe('usersController', () => {
  it('list envelope data', async () => {
    anySvc(usersService).list.mockResolvedValue([{ id: 'u1' }]);
    const { req, res } = ctx();
    await usersController.list(req, res);
    expect(res.body).toEqual({ data: [{ id: 'u1' }] });
  });
  it('invite → 201', async () => {
    anySvc(usersService).invite.mockResolvedValue({ id: 'u1' });
    const { req, res } = ctx();
    await usersController.invite(req, res);
    expect(res.statusCode).toBe(201);
  });
  it('updateRole → 200', async () => {
    anySvc(usersService).updateRole.mockResolvedValue({ id: 'u1' });
    const { req, res } = ctx({ params: { id: 'u1' } as never });
    await usersController.updateRole(req, res);
    expect(anySvc(usersService).updateRole).toHaveBeenCalledWith('t1', 'u1', expect.anything());
  });
  it('remove → 204 e passa requester', async () => {
    anySvc(usersService).remove.mockResolvedValue(undefined);
    const { req, res } = ctx({ params: { id: 'u1' } as never });
    await usersController.remove(req, res);
    expect(anySvc(usersService).remove).toHaveBeenCalledWith('t1', 'u1', 'uid-1');
    expect(res.statusCode).toBe(204);
  });
});

describe('instancesController', () => {
  it('list envelope data', async () => {
    anySvc(instancesService).list.mockResolvedValue([{ id: 'i1' }]);
    const { req, res } = ctx();
    await instancesController.list(req, res);
    expect(res.body).toEqual({ data: [{ id: 'i1' }] });
  });
  it('create → 201', async () => {
    anySvc(instancesService).create.mockResolvedValue({ id: 'i1' });
    const { req, res } = ctx();
    await instancesController.create(req, res);
    expect(res.statusCode).toBe(201);
  });
  it('get / qrCode / remove / send', async () => {
    anySvc(instancesService).get.mockResolvedValue({ id: 'i1' });
    anySvc(instancesService).getQrCode.mockResolvedValue({ qrCode: null });
    anySvc(instancesService).remove.mockResolvedValue(undefined);
    anySvc(instancesService).sendMessage.mockResolvedValue({ messageId: 'm1' });
    const { req, res } = ctx({ params: { id: 'i1' } as never });
    await instancesController.get(req, res);
    await instancesController.qrCode(req, res);
    await instancesController.remove(req, res);
    await instancesController.send(req, res);
    expect(anySvc(instancesService).sendMessage).toHaveBeenCalled();
  });
});

describe('contactsController', () => {
  it('list / create / get / update / remove', async () => {
    anySvc(contactsService).list.mockResolvedValue({ data: [] });
    anySvc(contactsService).create.mockResolvedValue({ id: 'c1' });
    anySvc(contactsService).get.mockResolvedValue({ id: 'c1' });
    anySvc(contactsService).update.mockResolvedValue({ id: 'c1' });
    anySvc(contactsService).remove.mockResolvedValue(undefined);
    const { req, res } = ctx({ params: { id: 'c1' } as never });
    await contactsController.list(req, res);
    await contactsController.create(req, res);
    await contactsController.get(req, res);
    await contactsController.update(req, res);
    await contactsController.remove(req, res);
    expect(res.statusCode).toBe(204);
  });
  it('importCsv / validatePhones / exportCsv', async () => {
    anySvc(contactsService).importCsv.mockResolvedValue({ imported: 1 });
    anySvc(contactsService).validatePhones.mockReturnValue({ valid: 1 });
    anySvc(contactsService).export.mockResolvedValue('phone,name');
    const { req, res } = ctx({ body: { phones: ['55'] } as never });
    await contactsController.importCsv(req, res);
    contactsController.validatePhones(req, res);
    await contactsController.exportCsv(req, res);
    expect(res.headers['Content-Type']).toContain('text/csv');
    expect(res.body).toBe('phone,name');
  });
});

describe('campaignsController', () => {
  it('list/create/get/update/start/pause/cancel/remove', async () => {
    const svc = anySvc(campaignsService);
    svc.list.mockResolvedValue({ data: [] });
    svc.create.mockResolvedValue({ id: 'cp1' });
    svc.get.mockResolvedValue({ id: 'cp1' });
    svc.update.mockResolvedValue({ id: 'cp1' });
    svc.start.mockResolvedValue({ status: 'RUNNING' });
    svc.pause.mockResolvedValue({ status: 'PAUSED' });
    svc.cancel.mockResolvedValue({ status: 'CANCELLED' });
    svc.remove.mockResolvedValue(undefined);
    const { req, res } = ctx({ params: { id: 'cp1' } as never });
    await campaignsController.list(req, res);
    await campaignsController.create(req, res);
    await campaignsController.get(req, res);
    await campaignsController.update(req, res);
    await campaignsController.start(req, res);
    await campaignsController.pause(req, res);
    await campaignsController.cancel(req, res);
    await campaignsController.remove(req, res);
    expect(res.statusCode).toBe(204);
  });
});

describe('conversationsController', () => {
  it('list/get/update/markRead', async () => {
    const svc = anySvc(conversationsService);
    svc.list.mockResolvedValue({ data: [] });
    svc.get.mockResolvedValue({ id: 'cv1' });
    svc.update.mockResolvedValue({ id: 'cv1' });
    svc.markRead.mockResolvedValue({ id: 'cv1' });
    const { req, res } = ctx({ params: { id: 'cv1' } as never });
    await conversationsController.list(req, res);
    await conversationsController.get(req, res);
    await conversationsController.update(req, res);
    await conversationsController.markRead(req, res);
    expect(res.statusCode).toBe(200);
  });
});

describe('messagesController', () => {
  it('list/send/addNote e repassa supabaseUid', async () => {
    const svc = anySvc(messagesService);
    svc.list.mockResolvedValue({ data: [] });
    svc.send.mockResolvedValue({ id: 'm1' });
    svc.addNote.mockResolvedValue({ id: 'n1' });
    const { req, res } = ctx({ params: { id: 'cv1' } as never });
    await messagesController.list(req, res);
    await messagesController.send(req, res);
    await messagesController.addNote(req, res);
    expect(svc.send).toHaveBeenCalledWith('t1', 'cv1', expect.anything(), 'uid-1');
    expect(res.statusCode).toBe(201);
  });
});

describe('flowsController', () => {
  it('list/create/get/update/publish/duplicate/remove', async () => {
    const svc = anySvc(flowsService);
    svc.list.mockResolvedValue([{ id: 'f1' }]);
    svc.create.mockResolvedValue({ id: 'f1' });
    svc.get.mockResolvedValue({ id: 'f1' });
    svc.update.mockResolvedValue({ id: 'f1' });
    svc.publish.mockResolvedValue({ id: 'f1' });
    svc.duplicate.mockResolvedValue({ id: 'f2' });
    svc.remove.mockResolvedValue(undefined);
    const { req, res } = ctx({ params: { id: 'f1' } as never });
    await flowsController.list(req, res);
    expect(res.body).toEqual({ data: [{ id: 'f1' }] });
    await flowsController.create(req, res);
    await flowsController.get(req, res);
    await flowsController.update(req, res);
    await flowsController.publish(req, res);
    await flowsController.duplicate(req, res);
    await flowsController.remove(req, res);
    expect(res.statusCode).toBe(204);
  });
});

describe('tagsController', () => {
  it('CRUD + attach/detach contato e conversa', async () => {
    const svc = anySvc(tagsService);
    svc.list.mockResolvedValue([{ id: 'tg1' }]);
    svc.create.mockResolvedValue({ id: 'tg1' });
    svc.update.mockResolvedValue({ id: 'tg1' });
    svc.remove.mockResolvedValue(undefined);
    svc.attachToContact.mockResolvedValue(undefined);
    svc.detachFromContact.mockResolvedValue(undefined);
    svc.attachToConversation.mockResolvedValue(undefined);
    svc.detachFromConversation.mockResolvedValue(undefined);
    const { req, res } = ctx({
      params: { id: 'x1', tagId: 'tg1' } as never,
      body: { tagId: 'tg1' } as never,
    });
    await tagsController.list(req, res);
    await tagsController.create(req, res);
    await tagsController.update(req, res);
    await tagsController.remove(req, res);
    await tagsController.attachToContact(req, res);
    await tagsController.detachFromContact(req, res);
    await tagsController.attachToConversation(req, res);
    await tagsController.detachFromConversation(req, res);
    expect(svc.attachToConversation).toHaveBeenCalledWith('t1', 'x1', 'tg1');
  });
});

describe('webhooksController', () => {
  it('list normaliza paginação / create / get / update / remove / deliveries / test', async () => {
    const svc = anySvc(webhooksService);
    svc.list.mockResolvedValue({ data: [] });
    svc.create.mockResolvedValue({ id: 'w1' });
    svc.get.mockResolvedValue({ id: 'w1' });
    svc.update.mockResolvedValue({ id: 'w1' });
    svc.remove.mockResolvedValue(undefined);
    svc.listDeliveries.mockResolvedValue({ data: [] });
    svc.testWebhook.mockResolvedValue({ queued: true });
    const { req, res } = ctx({
      params: { id: 'w1' } as never,
      query: { page: '0', pageSize: '999' } as never,
    });
    await webhooksController.list(req, res);
    expect(svc.list).toHaveBeenCalledWith('t1', { page: 1, pageSize: 100 });
    await webhooksController.create(req, res);
    await webhooksController.get(req, res);
    await webhooksController.update(req, res);
    await webhooksController.remove(req, res);
    const delCtx = ctx({ params: { id: 'w1' } as never, query: {} as never });
    await webhooksController.deliveries(delCtx.req, delCtx.res);
    await webhooksController.test(req, res);
    expect(res.statusCode).toBe(202);
  });
});

describe('webhookReceiverController', () => {
  it('responde 200 e delega ao service quando há evento', async () => {
    anySvc(webhookReceiverService).handle.mockResolvedValue(undefined);
    const { req, res } = ctx({
      params: { key: 'wf-x' } as never,
      body: { event: 'messages.upsert', data: { m: 1 } } as never,
    });
    await webhookReceiverController.receive(req, res);
    expect(res.statusCode).toBe(200);
    expect(anySvc(webhookReceiverService).handle).toHaveBeenCalledWith('wf-x', 'messages.upsert', {
      m: 1,
    });
  });
  it('não lança quando o service falha', async () => {
    anySvc(webhookReceiverService).handle.mockRejectedValue(new Error('boom'));
    const { req, res } = ctx({
      params: { key: 'wf-x', event: 'connection.update' } as never,
      body: { data: {} } as never,
    });
    await expect(webhookReceiverController.receive(req, res)).resolves.toBeUndefined();
  });
});

describe('analyticsController', () => {
  const q = { from: '2026-06-01', to: '2026-06-30', granularity: 'day' } as never;
  it('overview/messages/campaigns', async () => {
    anySvc(analyticsService).overview.mockResolvedValue({ ok: 1 });
    anySvc(analyticsService).messagesSeries.mockResolvedValue({ ok: 2 });
    anySvc(analyticsService).campaignsSummary.mockResolvedValue({ ok: 3 });
    const { req, res } = ctx({ query: q });
    await analyticsController.overview(req, res);
    await analyticsController.messages(req, res);
    await analyticsController.campaigns(req, res);
    expect(res.statusCode).toBe(200);
  });
  it('export seta headers CSV', async () => {
    anySvc(analyticsExportService).export.mockResolvedValue({
      filename: 'rel.csv',
      csv: 'a,b',
    });
    const { req, res } = ctx({
      query: { report: 'overview', from: '2026-06-01', to: '2026-06-30' } as never,
    });
    await analyticsController.export(req, res);
    expect(res.headers['Content-Disposition']).toContain('rel.csv');
    expect(res.body).toBe('a,b');
  });
});

describe('aiController', () => {
  it('getConfig/upsertConfig/test', async () => {
    anySvc(aiConfigService).getConfig.mockResolvedValue({ provider: 'groq' });
    anySvc(aiConfigService).upsertConfig.mockResolvedValue({ provider: 'groq' });
    anySvc(aiConfigService).test.mockResolvedValue({ ok: true });
    const { req, res } = ctx();
    await aiController.getConfig(req, res);
    await aiController.upsertConfig(req, res);
    await aiController.test(req, res);
    expect(res.statusCode).toBe(200);
  });
});
