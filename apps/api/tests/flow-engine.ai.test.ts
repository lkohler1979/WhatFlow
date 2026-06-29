import { flowRunner } from '@modules/flow-engine/flow-engine.runner.js';
import { flowEngineRepository as engineRepo } from '@modules/flow-engine/flow-engine.repository.js';
import { flowsRepository } from '@modules/flows/flows.repository.js';
import { evolutionApiService } from '@integrations/evolution-api/evolution-api.service.js';
import { aiService } from '@integrations/ai/ai.service.js';

jest.mock('@modules/flow-engine/flow-engine.repository.js');
jest.mock('@modules/flows/flows.repository.js');
jest.mock('@integrations/evolution-api/evolution-api.service.js');
jest.mock('@integrations/ai/ai.service.js');

const engine = engineRepo as jest.Mocked<typeof engineRepo>;
const flows = flowsRepository as jest.Mocked<typeof flowsRepository>;
const evo = evolutionApiService as jest.Mocked<typeof evolutionApiService>;
const ai = aiService as jest.Mocked<typeof aiService>;

// Fluxo: AI (responde pergunta aberta) → END. Gatilho ANY_MESSAGE.
const NODES = [
  {
    id: 'a1',
    type: 'AI',
    position: { x: 0, y: 0 },
    data: { prompt: 'Você é um atendente de {{empresa}}. Seja breve.', temperature: 0.5 },
  },
  { id: 'a2', type: 'END', position: { x: 0, y: 0 }, data: {} },
];
const EDGES = [{ id: 'e1', source: 'a1', target: 'a2' }];

const aiFlow = (over: Record<string, unknown> = {}) =>
  ({
    id: 'flow1',
    tenantId: 't1',
    name: 'Bot IA',
    description: null,
    instanceId: 'inst1',
    triggerType: 'ANY_MESSAGE',
    triggerValue: null,
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
  text: 'Qual o horário de funcionamento?',
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  evo.sendText.mockResolvedValue({} as never);
  engine.createOutboundMessage.mockResolvedValue({ id: 'm1' });
  engine.touchConversation.mockResolvedValue(undefined);
  engine.createSession.mockResolvedValue({} as never);
  engine.updateSession.mockResolvedValue(undefined);
  engine.findActiveSession.mockResolvedValue(null);
  engine.loadHistory.mockResolvedValue([]);
  ai.generate.mockResolvedValue({ content: 'Atendemos das 9h às 18h.', tokens: 12, latencyMs: 100 });
});

describe('flowRunner.runBot — nó de IA', () => {
  it('monta system(prompt do nó)+histórico+pergunta atual e chama aiService.generate', async () => {
    flows.findActivePublished.mockResolvedValue([aiFlow()]);
    engine.loadHistory.mockResolvedValue([
      { direction: 'INBOUND', content: 'Olá' },
      { direction: 'OUTBOUND', content: 'Oi! Como posso ajudar?' },
    ]);

    await flowRunner.runBot(ctx());

    expect(ai.generate).toHaveBeenCalledTimes(1);
    const [messages, opts] = ai.generate.mock.calls[0];
    // system = prompt do nó interpolado (sem {{empresa}} → vazio)
    expect(messages[0]).toEqual({
      role: 'system',
      content: 'Você é um atendente de . Seja breve.',
    });
    // histórico mapeado: INBOUND→user, OUTBOUND→assistant
    expect(messages[1]).toEqual({ role: 'user', content: 'Olá' });
    expect(messages[2]).toEqual({ role: 'assistant', content: 'Oi! Como posso ajudar?' });
    // pergunta atual do usuário presente ao final
    expect(messages[messages.length - 1]).toEqual({
      role: 'user',
      content: 'Qual o horário de funcionamento?',
    });
    // opts deriva do node.data (temperature)
    expect(opts).toEqual({ temperature: 0.5 });
  });

  it('envia a resposta da IA via sendText e persiste OUTBOUND', async () => {
    flows.findActivePublished.mockResolvedValue([aiFlow()]);

    await flowRunner.runBot(ctx());

    expect(evo.sendText).toHaveBeenCalledWith('key1', {
      number: '5527999',
      text: 'Atendemos das 9h às 18h.',
    });
    expect(engine.createOutboundMessage).toHaveBeenCalledWith('conv1', 'Atendemos das 9h às 18h.');
    expect(engine.touchConversation).toHaveBeenCalledWith('conv1', 'Atendemos das 9h às 18h.');
  });

  it('não duplica a pergunta atual quando já é a última do histórico', async () => {
    flows.findActivePublished.mockResolvedValue([aiFlow()]);
    engine.loadHistory.mockResolvedValue([
      { direction: 'INBOUND', content: 'Qual o horário de funcionamento?' },
    ]);

    await flowRunner.runBot(ctx());

    const [messages] = ai.generate.mock.calls[0];
    const userMsgs = messages.filter(m => m.role === 'user');
    expect(userMsgs).toHaveLength(1);
    expect(userMsgs[0].content).toBe('Qual o horário de funcionamento?');
  });

  it('erro do aiService é best-effort: não quebra o runBot e não envia resposta de IA', async () => {
    flows.findActivePublished.mockResolvedValue([aiFlow()]);
    ai.generate.mockRejectedValue(new Error('GROQ_API_KEY ausente'));

    await expect(flowRunner.runBot(ctx())).resolves.toBeUndefined();

    expect(evo.sendText).not.toHaveBeenCalled();
    expect(engine.createOutboundMessage).not.toHaveBeenCalled();
    // a sessão ainda é persistida normalmente
    expect(engine.createSession).toHaveBeenCalled();
  });

  it('em erro, envia mensagem de fallback se o nó definir data.fallback', async () => {
    flows.findActivePublished.mockResolvedValue([
      aiFlow({
        nodesJson: [
          {
            id: 'a1',
            type: 'AI',
            position: { x: 0, y: 0 },
            data: { prompt: 'Ajude o cliente.', fallback: 'Desculpe, tente novamente mais tarde.' },
          },
          { id: 'a2', type: 'END', position: { x: 0, y: 0 }, data: {} },
        ],
      }),
    ]);
    ai.generate.mockRejectedValue(new Error('timeout'));

    await flowRunner.runBot(ctx());

    expect(evo.sendText).toHaveBeenCalledWith('key1', {
      number: '5527999',
      text: 'Desculpe, tente novamente mais tarde.',
    });
  });
});
