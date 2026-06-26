import { advance, interpolate } from '@modules/flow-engine/flow-engine.service.js';
import type { FlowGraph, SessionState } from '@modules/flow-engine/flow-engine.types.js';

// Fluxo simples: TEXT → MENU (Suporte/Vendas) → TEXT (resposta) → END
const graph: FlowGraph = {
  nodes: [
    { id: 'n1', type: 'TEXT', data: { text: 'Olá {{nome}}!' } },
    { id: 'n2', type: 'MENU', data: { text: 'Escolha:', options: [
      { id: 'a', label: 'Suporte' },
      { id: 'b', label: 'Vendas' },
    ] } },
    { id: 'n3', type: 'TEXT', data: { text: 'Você escolheu suporte' } },
    { id: 'n4', type: 'TEXT', data: { text: 'Você escolheu vendas' } },
    { id: 'n5', type: 'END' },
  ],
  edges: [
    { source: 'n1', target: 'n2' },
    { source: 'n2', target: 'n3', sourceHandle: 'a' },
    { source: 'n2', target: 'n4', sourceHandle: 'b' },
    { source: 'n3', target: 'n5' },
    { source: 'n4', target: 'n5' },
  ],
};

const fresh = (vars = {}): SessionState => ({
  currentNodeId: null,
  variables: vars,
  waitingForInput: false,
});

describe('FlowEngine.interpolate', () => {
  it('substitui variáveis {{x}}', () => {
    expect(interpolate('Oi {{nome}}, n {{numero}}', { nome: 'Ana', numero: 5 })).toBe('Oi Ana, n 5');
  });
  it('vazio para variável ausente', () => {
    expect(interpolate('a{{x}}b', {})).toBe('ab');
  });
});

describe('FlowEngine.advance — fluxo simples', () => {
  it('início: emite texto + menu e fica WAITING no menu', () => {
    const r = advance(graph, fresh({ nome: 'João' }), 'oi');
    expect(r.status).toBe('WAITING');
    expect(r.state.waitingForInput).toBe(true);
    expect(r.state.currentNodeId).toBe('n2');
    expect(r.messages[0]).toEqual({ type: 'text', text: 'Olá João!', mediaUrl: undefined });
    expect(r.messages[1].text).toContain('Escolha:');
    expect(r.messages[1].text).toContain('1. Suporte');
    expect(r.messages[1].text).toContain('2. Vendas');
  });

  it('resposta por índice "1" → ramo suporte → END (COMPLETED)', () => {
    const waiting: SessionState = { currentNodeId: 'n2', variables: { nome: 'João' }, waitingForInput: true };
    const r = advance(graph, waiting, '1');
    expect(r.status).toBe('COMPLETED');
    expect(r.state.waitingForInput).toBe(false);
    expect(r.state.variables.opcao_selecionada).toBe('a');
    expect(r.messages).toHaveLength(1);
    expect(r.messages[0].text).toBe('Você escolheu suporte');
  });

  it('resposta por rótulo "Vendas" → ramo vendas', () => {
    const waiting: SessionState = { currentNodeId: 'n2', variables: {}, waitingForInput: true };
    const r = advance(graph, waiting, 'Vendas');
    expect(r.messages[0].text).toBe('Você escolheu vendas');
    expect(r.status).toBe('COMPLETED');
  });

  it('opção inválida → re-emite o menu e continua WAITING', () => {
    const waiting: SessionState = { currentNodeId: 'n2', variables: {}, waitingForInput: true };
    const r = advance(graph, waiting, '9');
    expect(r.status).toBe('WAITING');
    expect(r.state.waitingForInput).toBe(true);
    expect(r.messages[0].text).toContain('1. Suporte');
  });
});

describe('FlowEngine.advance — CONDITION', () => {
  const cond: FlowGraph = {
    nodes: [
      { id: 'c', type: 'CONDITION', data: { variable: 'plano', operator: 'eq', value: 'PRO' } },
      { id: 't', type: 'TEXT', data: { text: 'É PRO' } },
      { id: 'f', type: 'TEXT', data: { text: 'Não é PRO' } },
      { id: 'e', type: 'END' },
    ],
    edges: [
      { source: 'c', target: 't', sourceHandle: 'true' },
      { source: 'c', target: 'f', sourceHandle: 'false' },
      { source: 't', target: 'e' },
      { source: 'f', target: 'e' },
    ],
  };

  it('ramo verdadeiro quando a variável bate', () => {
    const r = advance(cond, fresh({ plano: 'PRO' }));
    expect(r.messages[0].text).toBe('É PRO');
    expect(r.status).toBe('COMPLETED');
  });

  it('ramo falso caso contrário', () => {
    const r = advance(cond, fresh({ plano: 'FREE' }));
    expect(r.messages[0].text).toBe('Não é PRO');
  });
});
