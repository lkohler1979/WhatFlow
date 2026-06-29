import { advance } from '@modules/flow-engine/flow-engine.service.js';
import type { FlowGraph, SessionState } from '@modules/flow-engine/flow-engine.types.js';

const fresh = (vars: Record<string, unknown> = {}): SessionState => ({
  currentNodeId: null,
  variables: vars,
  waitingForInput: false,
});

const waitingAt = (id: string, vars: Record<string, unknown> = {}): SessionState => ({
  currentNodeId: id,
  variables: vars,
  waitingForInput: true,
});

// ---------------------------------------------------------------------------
// Mensagens: TEXT / IMAGE / AUDIO / VIDEO / DOCUMENT
// ---------------------------------------------------------------------------
describe('FlowEngine — nó TEXT', () => {
  const g: FlowGraph = {
    nodes: [
      { id: 'n1', type: 'TEXT', data: { text: 'Olá {{nome}}!' } },
      { id: 'e', type: 'END' },
    ],
    edges: [{ source: 'n1', target: 'e' }],
  };

  it('emite mensagem text com interpolação', () => {
    const r = advance(g, fresh({ nome: 'Ana' }));
    expect(r.messages).toEqual([{ type: 'text', text: 'Olá Ana!', mediaUrl: undefined }]);
    expect(r.status).toBe('COMPLETED');
  });

  it('variável ausente vira string vazia', () => {
    const r = advance(g, fresh());
    expect(r.messages[0].text).toBe('Olá !');
  });
});

describe.each([
  ['IMAGE', 'image'],
  ['AUDIO', 'audio'],
  ['VIDEO', 'video'],
  ['DOCUMENT', 'document'],
] as const)('FlowEngine — nó de mídia %s', (nodeType, msgType) => {
  const g: FlowGraph = {
    nodes: [
      {
        id: 'm',
        type: nodeType,
        data: { text: 'Legenda {{x}}', mediaUrl: 'https://cdn/file.bin' },
      },
      { id: 'e', type: 'END' },
    ],
    edges: [{ source: 'm', target: 'e' }],
  };

  it(`emite mensagem ${msgType} com mediaUrl e caption interpolado`, () => {
    const r = advance(g, fresh({ x: '42' }));
    expect(r.messages).toEqual([
      { type: msgType, text: 'Legenda 42', mediaUrl: 'https://cdn/file.bin' },
    ]);
    expect(r.status).toBe('COMPLETED');
  });

  it('mídia sem text ainda inclui mediaUrl', () => {
    const g2: FlowGraph = {
      nodes: [{ id: 'm', type: nodeType, data: { mediaUrl: 'https://cdn/x' } }],
      edges: [],
    };
    const r = advance(g2, fresh());
    expect(r.messages[0]).toEqual({ type: msgType, text: undefined, mediaUrl: 'https://cdn/x' });
  });
});

// ---------------------------------------------------------------------------
// MENU
// ---------------------------------------------------------------------------
describe('FlowEngine — nó MENU', () => {
  const g: FlowGraph = {
    nodes: [
      {
        id: 'menu',
        type: 'MENU',
        data: {
          text: 'Escolha {{nome}}:',
          options: [
            { id: 'sup', label: 'Suporte' },
            { id: 'ven', label: 'Vendas' },
          ],
        },
      },
      { id: 'a', type: 'TEXT', data: { text: 'ramo suporte' } },
      { id: 'b', type: 'TEXT', data: { text: 'ramo vendas' } },
      { id: 'e', type: 'END' },
    ],
    edges: [
      { source: 'menu', target: 'a', sourceHandle: 'sup' },
      { source: 'menu', target: 'b', sourceHandle: 'ven' },
      { source: 'a', target: 'e' },
      { source: 'b', target: 'e' },
    ],
  };

  it('emite o prompt numerado e aguarda', () => {
    const r = advance(g, fresh({ nome: 'Ana' }));
    expect(r.status).toBe('WAITING');
    expect(r.state.waitingForInput).toBe(true);
    expect(r.state.currentNodeId).toBe('menu');
    expect(r.messages[0].text).toContain('Escolha Ana:');
    expect(r.messages[0].text).toContain('1. Suporte');
    expect(r.messages[0].text).toContain('2. Vendas');
  });

  it('resume casando por índice 1-based', () => {
    const r = advance(g, waitingAt('menu'), '2');
    expect(r.state.variables.opcao_selecionada).toBe('ven');
    expect(r.messages[0].text).toBe('ramo vendas');
    expect(r.status).toBe('COMPLETED');
  });

  it('resume casando por rótulo (case-insensitive)', () => {
    const r = advance(g, waitingAt('menu'), 'suporte');
    expect(r.state.variables.opcao_selecionada).toBe('sup');
    expect(r.messages[0].text).toBe('ramo suporte');
  });

  it('resume casando por id da opção', () => {
    const r = advance(g, waitingAt('menu'), 'ven');
    expect(r.state.variables.opcao_selecionada).toBe('ven');
    expect(r.messages[0].text).toBe('ramo vendas');
  });

  it('opção inválida re-emite o menu e continua WAITING', () => {
    const r = advance(g, waitingAt('menu'), 'xpto');
    expect(r.status).toBe('WAITING');
    expect(r.state.waitingForInput).toBe(true);
    expect(r.state.currentNodeId).toBe('menu');
    expect(r.messages[0].text).toContain('1. Suporte');
  });
});

// ---------------------------------------------------------------------------
// CONDITION — eq / neq / contains / gt / lt
// ---------------------------------------------------------------------------
describe('FlowEngine — nó CONDITION', () => {
  const build = (op: 'eq' | 'neq' | 'contains' | 'gt' | 'lt', value: string): FlowGraph => ({
    nodes: [
      { id: 'c', type: 'CONDITION', data: { variable: 'v', operator: op, value } },
      { id: 't', type: 'TEXT', data: { text: 'TRUE' } },
      { id: 'f', type: 'TEXT', data: { text: 'FALSE' } },
    ],
    edges: [
      { source: 'c', target: 't', sourceHandle: 'true' },
      { source: 'c', target: 'f', sourceHandle: 'false' },
    ],
  });

  const branch = (g: FlowGraph, vars: Record<string, unknown>) =>
    advance(g, fresh(vars)).messages[0].text;

  it('eq: true quando igual, false quando diferente', () => {
    expect(branch(build('eq', 'PRO'), { v: 'PRO' })).toBe('TRUE');
    expect(branch(build('eq', 'PRO'), { v: 'FREE' })).toBe('FALSE');
  });

  it('neq: true quando diferente', () => {
    expect(branch(build('neq', 'PRO'), { v: 'FREE' })).toBe('TRUE');
    expect(branch(build('neq', 'PRO'), { v: 'PRO' })).toBe('FALSE');
  });

  it('contains: substring case-insensitive', () => {
    expect(branch(build('contains', 'erro'), { v: 'Tem um ERRO aqui' })).toBe('TRUE');
    expect(branch(build('contains', 'erro'), { v: 'tudo certo' })).toBe('FALSE');
  });

  it('gt: comparação numérica', () => {
    expect(branch(build('gt', '10'), { v: '15' })).toBe('TRUE');
    expect(branch(build('gt', '10'), { v: '5' })).toBe('FALSE');
  });

  it('lt: comparação numérica', () => {
    expect(branch(build('lt', '10'), { v: '5' })).toBe('TRUE');
    expect(branch(build('lt', '10'), { v: '15' })).toBe('FALSE');
  });

  it('sem variável definida, usa o input do usuário como lado esquerdo', () => {
    const g: FlowGraph = {
      nodes: [
        { id: 'c', type: 'CONDITION', data: { operator: 'eq', value: 'sim' } },
        { id: 't', type: 'TEXT', data: { text: 'TRUE' } },
        { id: 'f', type: 'TEXT', data: { text: 'FALSE' } },
      ],
      edges: [
        { source: 'c', target: 't', sourceHandle: 'true' },
        { source: 'c', target: 'f', sourceHandle: 'false' },
      ],
    };
    expect(advance(g, waitingAt('c'), 'sim').messages[0].text).toBe('TRUE');
  });
});

// ---------------------------------------------------------------------------
// VARIABLE
// ---------------------------------------------------------------------------
describe('FlowEngine — nó VARIABLE', () => {
  it('value: grava valor estático e fica disponível via interpolação', () => {
    const g: FlowGraph = {
      nodes: [
        { id: 'v', type: 'VARIABLE', data: { name: 'plano', value: 'PRO' } },
        { id: 't', type: 'TEXT', data: { text: 'Plano {{plano}}' } },
      ],
      edges: [{ source: 'v', target: 't' }],
    };
    const r = advance(g, fresh());
    expect(r.state.variables.plano).toBe('PRO');
    expect(r.messages[0].text).toBe('Plano PRO');
  });

  it('fromInput: grava a última mensagem do usuário', () => {
    const g: FlowGraph = {
      nodes: [
        { id: 'v', type: 'VARIABLE', data: { name: 'nome', fromInput: true } },
        { id: 't', type: 'TEXT', data: { text: 'Oi {{nome}}' } },
      ],
      edges: [{ source: 'v', target: 't' }],
    };
    const r = advance(g, waitingAt('v'), 'Maria');
    expect(r.state.variables.nome).toBe('Maria');
    expect(r.messages[0].text).toBe('Oi Maria');
  });

  it('sem name: apenas avança sem gravar', () => {
    const g: FlowGraph = {
      nodes: [
        { id: 'v', type: 'VARIABLE', data: { value: 'x' } },
        { id: 'e', type: 'END' },
      ],
      edges: [{ source: 'v', target: 'e' }],
    };
    const r = advance(g, fresh());
    expect(r.status).toBe('COMPLETED');
    expect(Object.keys(r.state.variables)).not.toContain('undefined');
  });
});

// ---------------------------------------------------------------------------
// DELAY / AI / WEBHOOK_CALL
// ---------------------------------------------------------------------------
describe('FlowEngine — nó DELAY', () => {
  it('gera action delay com ms', () => {
    const g: FlowGraph = {
      nodes: [
        { id: 'd', type: 'DELAY', data: { ms: 2500 } },
        { id: 'e', type: 'END' },
      ],
      edges: [{ source: 'd', target: 'e' }],
    };
    const r = advance(g, fresh());
    expect(r.actions).toEqual([{ kind: 'delay', ms: 2500 }]);
    expect(r.status).toBe('COMPLETED');
  });

  it('usa default 1000ms quando ms ausente', () => {
    const g: FlowGraph = { nodes: [{ id: 'd', type: 'DELAY' }], edges: [] };
    expect(advance(g, fresh()).actions).toEqual([{ kind: 'delay', ms: 1000 }]);
  });
});

describe('FlowEngine — nó AI', () => {
  it('gera action ai com prompt e nodeId', () => {
    const g: FlowGraph = {
      nodes: [
        { id: 'ai1', type: 'AI', data: { prompt: 'Resuma {{texto}}' } },
        { id: 'e', type: 'END' },
      ],
      edges: [{ source: 'ai1', target: 'e' }],
    };
    const r = advance(g, fresh());
    expect(r.actions).toEqual([{ kind: 'ai', prompt: 'Resuma {{texto}}', nodeId: 'ai1' }]);
  });

  it('prompt opcional pode ser undefined', () => {
    const g: FlowGraph = { nodes: [{ id: 'ai1', type: 'AI' }], edges: [] };
    expect(advance(g, fresh()).actions).toEqual([
      { kind: 'ai', prompt: undefined, nodeId: 'ai1' },
    ]);
  });
});

describe('FlowEngine — nó WEBHOOK_CALL', () => {
  it('gera action webhook_call', () => {
    const g: FlowGraph = {
      nodes: [
        { id: 'w', type: 'WEBHOOK_CALL' },
        { id: 'e', type: 'END' },
      ],
      edges: [{ source: 'w', target: 'e' }],
    };
    const r = advance(g, fresh());
    expect(r.actions).toEqual([{ kind: 'webhook_call' }]);
    expect(r.status).toBe('COMPLETED');
  });
});

// ---------------------------------------------------------------------------
// ASSIGN_AGENT / END
// ---------------------------------------------------------------------------
describe('FlowEngine — nó ASSIGN_AGENT', () => {
  it('gera action assign_agent e finaliza COMPLETED', () => {
    const g: FlowGraph = {
      nodes: [
        { id: 'msg', type: 'TEXT', data: { text: 'transferindo...' } },
        { id: 'ag', type: 'ASSIGN_AGENT' },
        { id: 'e', type: 'END' },
      ],
      edges: [
        { source: 'msg', target: 'ag' },
        { source: 'ag', target: 'e' },
      ],
    };
    const r = advance(g, fresh());
    expect(r.actions).toEqual([{ kind: 'assign_agent' }]);
    expect(r.status).toBe('COMPLETED');
    expect(r.state.currentNodeId).toBeNull();
    expect(r.state.waitingForInput).toBe(false);
  });
});

describe('FlowEngine — nó END', () => {
  it('finaliza COMPLETED com currentNodeId nulo', () => {
    const g: FlowGraph = { nodes: [{ id: 'e', type: 'END' }], edges: [] };
    const r = advance(g, fresh());
    expect(r.status).toBe('COMPLETED');
    expect(r.state.currentNodeId).toBeNull();
    expect(r.messages).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tipo desconhecido (defensivo)
// ---------------------------------------------------------------------------
describe('FlowEngine — tipo desconhecido', () => {
  it('encerra com status FAILED', () => {
    const g: FlowGraph = {
      // @ts-expect-error tipo inválido proposital para validar o caminho defensivo
      nodes: [{ id: 'x', type: 'NOPE' }],
      edges: [],
    };
    expect(advance(g, fresh()).status).toBe('FAILED');
  });
});

// ---------------------------------------------------------------------------
// Integração: fluxo encadeando todos os tipos
// ---------------------------------------------------------------------------
describe('FlowEngine — fluxo com todos os tipos', () => {
  // TEXT → VARIABLE(value) → CONDITION → IMAGE/AUDIO/VIDEO/DOCUMENT(true)
  //      → DELAY → AI → WEBHOOK_CALL → MENU → (opção) → ASSIGN_AGENT | END
  const g: FlowGraph = {
    nodes: [
      { id: 'txt', type: 'TEXT', data: { text: 'Bem-vindo {{nome}}' } },
      { id: 'var', type: 'VARIABLE', data: { name: 'plano', value: 'PRO' } },
      { id: 'cond', type: 'CONDITION', data: { variable: 'plano', operator: 'eq', value: 'PRO' } },
      { id: 'img', type: 'IMAGE', data: { text: 'banner', mediaUrl: 'https://cdn/img.png' } },
      { id: 'aud', type: 'AUDIO', data: { mediaUrl: 'https://cdn/a.ogg' } },
      { id: 'vid', type: 'VIDEO', data: { mediaUrl: 'https://cdn/v.mp4' } },
      { id: 'doc', type: 'DOCUMENT', data: { mediaUrl: 'https://cdn/d.pdf' } },
      { id: 'free', type: 'TEXT', data: { text: 'plano free' } },
      { id: 'delay', type: 'DELAY', data: { ms: 500 } },
      { id: 'ai', type: 'AI', data: { prompt: 'olá' } },
      { id: 'hook', type: 'WEBHOOK_CALL' },
      {
        id: 'menu',
        type: 'MENU',
        data: {
          text: 'Próximo passo?',
          options: [
            { id: 'humano', label: 'Falar com humano' },
            { id: 'sair', label: 'Encerrar' },
          ],
        },
      },
      { id: 'agent', type: 'ASSIGN_AGENT' },
      { id: 'end', type: 'END' },
    ],
    edges: [
      { source: 'txt', target: 'var' },
      { source: 'var', target: 'cond' },
      { source: 'cond', target: 'img', sourceHandle: 'true' },
      { source: 'cond', target: 'free', sourceHandle: 'false' },
      { source: 'img', target: 'aud' },
      { source: 'aud', target: 'vid' },
      { source: 'vid', target: 'doc' },
      { source: 'doc', target: 'delay' },
      { source: 'free', target: 'delay' },
      { source: 'delay', target: 'ai' },
      { source: 'ai', target: 'hook' },
      { source: 'hook', target: 'menu' },
      { source: 'menu', target: 'agent', sourceHandle: 'humano' },
      { source: 'menu', target: 'end', sourceHandle: 'sair' },
      { source: 'agent', target: 'end' },
    ],
  };

  it('percorre todos os tipos na ordem e pausa no MENU (WAITING)', () => {
    const r = advance(g, fresh({ nome: 'João' }), 'oi');

    expect(r.status).toBe('WAITING');
    expect(r.state.waitingForInput).toBe(true);
    expect(r.state.currentNodeId).toBe('menu');
    expect(r.state.variables.plano).toBe('PRO');

    // Mensagens: TEXT + IMAGE + AUDIO + VIDEO + DOCUMENT + prompt do MENU
    expect(r.messages.map(m => m.type)).toEqual([
      'text',
      'image',
      'audio',
      'video',
      'document',
      'text',
    ]);
    expect(r.messages[0].text).toBe('Bem-vindo João');
    expect(r.messages[1].mediaUrl).toBe('https://cdn/img.png');
    expect(r.messages[5].text).toContain('Próximo passo?');
    expect(r.messages[5].text).toContain('1. Falar com humano');

    // Ações acumuladas até o MENU: delay → ai → webhook_call
    expect(r.actions).toEqual([
      { kind: 'delay', ms: 500 },
      { kind: 'ai', prompt: 'olá', nodeId: 'ai' },
      { kind: 'webhook_call' },
    ]);
  });

  it('resume no MENU pela opção "humano" → ASSIGN_AGENT → END (COMPLETED)', () => {
    const waiting: SessionState = {
      currentNodeId: 'menu',
      variables: { nome: 'João', plano: 'PRO' },
      waitingForInput: true,
    };
    const r = advance(g, waiting, '1');
    expect(r.status).toBe('COMPLETED');
    expect(r.state.waitingForInput).toBe(false);
    expect(r.state.currentNodeId).toBeNull();
    expect(r.actions).toEqual([{ kind: 'assign_agent' }]);
    expect(r.state.variables.opcao_selecionada).toBe('humano');
  });

  it('resume no MENU pela opção "sair" → END direto (COMPLETED, sem actions)', () => {
    const waiting: SessionState = {
      currentNodeId: 'menu',
      variables: { plano: 'PRO' },
      waitingForInput: true,
    };
    const r = advance(g, waiting, 'Encerrar');
    expect(r.status).toBe('COMPLETED');
    expect(r.actions).toHaveLength(0);
    expect(r.messages).toHaveLength(0);
  });

  it('ramo CONDITION false pula as mídias e segue para DELAY', () => {
    // Inicia direto na CONDITION (após o VARIABLE) com plano FREE para
    // exercitar o ramo falso sem que o nó VARIABLE sobrescreva o valor.
    const atCond: SessionState = {
      currentNodeId: 'cond',
      variables: { nome: 'João', plano: 'FREE' },
      waitingForInput: false,
    };
    const r = advance(g, atCond);
    expect(r.status).toBe('WAITING');
    // free + prompt do MENU (sem as 4 mídias)
    expect(r.messages.map(m => m.type)).toEqual(['text', 'text']);
    expect(r.messages[0].text).toBe('plano free');
    expect(r.actions.map(a => a.kind)).toEqual(['delay', 'ai', 'webhook_call']);
  });
});
