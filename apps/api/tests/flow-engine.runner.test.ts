import { flowRunner } from '@modules/flow-engine/flow-engine.runner.js';
import { flowEngineRepository as engineRepo } from '@modules/flow-engine/flow-engine.repository.js';
import { flowsRepository } from '@modules/flows/flows.repository.js';
import { evolutionApiService } from '@integrations/evolution-api/evolution-api.service.js';

jest.mock('@modules/flow-engine/flow-engine.repository.js');
jest.mock('@modules/flows/flows.repository.js');
jest.mock('@integrations/evolution-api/evolution-api.service.js');

const engine = engineRepo as jest.Mocked<typeof engineRepo>;
const flows = flowsRepository as jest.Mocked<typeof flowsRepository>;
const evo = evolutionApiService as jest.Mocked<typeof evolutionApiService>;

// Fluxo: TEXT "Olá!" → MENU(Suporte/Vendas) → TEXT resposta → END
const NODES = [
  { id: 'n1', type: 'TEXT', position: { x: 0, y: 0 }, data: { text: 'Olá!' } },
  {
    id: 'n2',
    type: 'MENU',
    position: { x: 0, y: 0 },
    data: {
      text: 'Escolha uma opção:',
      options: [
        { id: 'sup', label: 'Suporte' },
        { id: 'ven', label: 'Vendas' },
      ],
    },
  },
  { id: 'n3', type: 'TEXT', position: { x: 0, y: 0 }, data: { text: 'Você escolheu suporte' } },
  { id: 'n4', type: 'TEXT', position: { x: 0, y: 0 }, data: { text: 'Você escolheu vendas' } },
  { id: 'n5', type: 'END', position: { x: 0, y: 0 }, data: {} },
];
const EDGES = [
  { id: 'e1', source: 'n1', target: 'n2' },
  { id: 'e2', source: 'n2', target: 'n3', sourceHandle: 'sup' },
  { id: 'e3', source: 'n2', target: 'n4', sourceHandle: 'ven' },
  { id: 'e4', source: 'n3', target: 'n5' },
  { id: 'e5', source: 'n4', target: 'n5' },
];

const publishedFlow = (over: Record<string, unknown> = {}) =>
  ({
    id: 'flow1',
    tenantId: 't1',
    name: 'Bot',
    description: null,
    instanceId: 'inst1',
    triggerType: 'KEYWORD',
    triggerValue: 'oi',
    nodesJson: NODES,
    edgesJson: EDGES,
    status: 'PUBLISHED',
    version: 1,
    publishedAt: new Date(),
    isActive: true,
    priority: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }) as never;

const ctx = (over: Record<string, unknown> = {}) => ({
  tenantId: 't1',
  instanceId: 'inst1',
  evolutionKey: 'key1',
  conversationId: 'conv1',
  botActive: true,
  replyTo: '5527999',
  contactPhone: '5527999',
  text: 'oi',
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  evo.sendText.mockResolvedValue({});
  engine.createOutboundMessage.mockResolvedValue({ id: 'm1' });
  engine.touchConversation.mockResolvedValue(undefined);
  engine.createSession.mockResolvedValue({} as never);
  engine.updateSession.mockResolvedValue(undefined);
});

describe('flowRunner.runBot', () => {
  it('gatilho KEYWORD "oi" → inicia fluxo, envia boas-vindas + menu e cria sessão aguardando', async () => {
    engine.findActiveSession.mockResolvedValue(null);
    flows.findActivePublished.mockResolvedValue([publishedFlow()]);

    await flowRunner.runBot(ctx());

    expect(evo.sendText).toHaveBeenCalledTimes(2); // "Olá!" + prompt do menu
    expect(evo.sendText).toHaveBeenNthCalledWith(1, 'key1', {
      number: '5527999',
      text: 'Olá!',
    });
    expect(engine.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ flowId: 'flow1', waitingForInput: true, completed: false }),
    );
  });

  it('resume: sessão aguardando no menu + input "1" → responde suporte e conclui', async () => {
    engine.findActiveSession.mockResolvedValue({
      id: 'sess1',
      flowId: 'flow1',
      conversationId: 'conv1',
      currentNodeId: 'n2',
      variables: { numero: '5527999' },
      waitingForInput: true,
    } as never);
    flows.findByIdInTenant.mockResolvedValue(publishedFlow());

    await flowRunner.runBot(ctx({ text: '1' }));

    expect(evo.sendText).toHaveBeenCalledWith('key1', {
      number: '5527999',
      text: 'Você escolheu suporte',
    });
    expect(engine.updateSession).toHaveBeenCalledWith(
      'sess1',
      expect.objectContaining({ completed: true, waitingForInput: false }),
    );
  });

  it('bot desligado → não envia nada', async () => {
    await flowRunner.runBot(ctx({ botActive: false }));
    expect(evo.sendText).not.toHaveBeenCalled();
    expect(engine.findActiveSession).not.toHaveBeenCalled();
  });

  it('nenhum gatilho casa → não envia nada', async () => {
    engine.findActiveSession.mockResolvedValue(null);
    flows.findActivePublished.mockResolvedValue([publishedFlow({ triggerValue: 'menu' })]);
    await flowRunner.runBot(ctx({ text: 'qualquer coisa' }));
    expect(evo.sendText).not.toHaveBeenCalled();
    expect(engine.createSession).not.toHaveBeenCalled();
  });

  it('responde para o replyTo (jid @lid) e não para o número do contato', async () => {
    engine.findActiveSession.mockResolvedValue(null);
    flows.findActivePublished.mockResolvedValue([publishedFlow()]);
    const lid = '261967335915753@lid';
    await flowRunner.runBot(ctx({ replyTo: lid, contactPhone: '261967335915753' }));
    expect(evo.sendText).toHaveBeenNthCalledWith(1, 'key1', { number: lid, text: 'Olá!' });
  });
});
