import type {
  FlowGraph,
  FlowNode,
  OutboundMessage,
  EngineAction,
  EngineResult,
  SessionState,
  OutboundMessageType,
} from './flow-engine.types.js';

const MAX_STEPS = 100;
const MESSAGE_TYPES: Record<string, OutboundMessageType> = {
  TEXT: 'text',
  IMAGE: 'image',
  AUDIO: 'audio',
  VIDEO: 'video',
  DOCUMENT: 'document',
};

/** Substitui {{variavel}} pelo valor em `vars`. */
export function interpolate(text: string, vars: Record<string, unknown>): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => {
    const v = vars[key];
    return v === undefined || v === null ? '' : String(v);
  });
}

function findNode(graph: FlowGraph, id: string | null): FlowNode | null {
  if (!id) return null;
  return graph.nodes.find(n => n.id === id) ?? null;
}

/** Nó de entrada: o primeiro nó que não é alvo de nenhuma aresta. */
function entryNode(graph: FlowGraph): FlowNode | null {
  const targets = new Set(graph.edges.map(e => e.target));
  return graph.nodes.find(n => !targets.has(n.id)) ?? graph.nodes[0] ?? null;
}

/** Próximo nó seguindo a aresta cujo handle bate (default: 'out'/sem handle). */
function nextNode(graph: FlowGraph, nodeId: string, handle = 'out'): FlowNode | null {
  const edge =
    graph.edges.find(e => e.source === nodeId && (e.sourceHandle ?? 'out') === handle) ??
    (handle === 'out'
      ? graph.edges.find(e => e.source === nodeId && e.sourceHandle === undefined)
      : undefined);
  return edge ? findNode(graph, edge.target) : null;
}

/** Casa o input do usuário com uma opção (por id, rótulo ou índice 1-based). */
function matchOption(node: FlowNode, input: string) {
  const options = node.data?.options ?? [];
  const trimmed = input.trim();
  const byIndex = Number.parseInt(trimmed, 10);
  return (
    options.find(o => o.id === trimmed) ??
    options.find(o => o.label.toLowerCase() === trimmed.toLowerCase()) ??
    (Number.isInteger(byIndex) && byIndex >= 1 && byIndex <= options.length
      ? options[byIndex - 1]
      : undefined)
  );
}

function menuPrompt(node: FlowNode, vars: Record<string, unknown>): string {
  const head = node.data?.text ? interpolate(node.data.text, vars) : '';
  const opts = (node.data?.options ?? []).map((o, i) => `${i + 1}. ${o.label}`).join('\n');
  return [head, opts].filter(Boolean).join('\n');
}

function evalCondition(node: FlowNode, vars: Record<string, unknown>, input?: string): boolean {
  const d = node.data ?? {};
  const left = String((d.variable ? vars[d.variable] : undefined) ?? input ?? '');
  const right = String(d.value ?? '');
  switch (d.operator) {
    case 'neq':
      return left !== right;
    case 'contains':
      return left.toLowerCase().includes(right.toLowerCase());
    case 'gt':
      return Number(left) > Number(right);
    case 'lt':
      return Number(left) < Number(right);
    case 'eq':
    default:
      return left === right;
  }
}

/**
 * Avança o fluxo a partir do estado atual, consumindo `input` (mensagem do
 * usuário) quando a sessão estava aguardando entrada. Função PURA.
 */
export function advance(graph: FlowGraph, state: SessionState, input?: string): EngineResult {
  const messages: OutboundMessage[] = [];
  const actions: EngineAction[] = [];
  const vars: Record<string, unknown> = { ...state.variables };
  if (input !== undefined) vars.ultima_mensagem = input;

  let current = state.currentNodeId ? findNode(graph, state.currentNodeId) : entryNode(graph);
  // Só consumimos o input como resposta se a sessão estava aguardando nesse nó.
  let consuming = state.waitingForInput && input !== undefined;
  let status: EngineResult['status'] = 'COMPLETED';
  let waiting = false;

  for (let steps = 0; steps < MAX_STEPS; steps += 1) {
    if (!current) {
      status = 'COMPLETED';
      break;
    }
    const type = current.type;

    if (MESSAGE_TYPES[type]) {
      messages.push({
        type: MESSAGE_TYPES[type],
        text: current.data?.text ? interpolate(current.data.text, vars) : undefined,
        mediaUrl: current.data?.mediaUrl,
      });
      current = nextNode(graph, current.id);
      continue;
    }

    if (type === 'MENU') {
      if (consuming) {
        const option = matchOption(current, input as string);
        consuming = false;
        if (!option) {
          messages.push({ type: 'text', text: menuPrompt(current, vars) });
          waiting = true;
          status = 'WAITING';
          break;
        }
        vars.opcao_selecionada = option.id;
        current = nextNode(graph, current.id, option.id) ?? nextNode(graph, current.id);
        continue;
      }
      messages.push({ type: 'text', text: menuPrompt(current, vars) });
      waiting = true;
      status = 'WAITING';
      break;
    }

    if (type === 'CONDITION') {
      const branch = evalCondition(current, vars, input) ? 'true' : 'false';
      current = nextNode(graph, current.id, branch);
      continue;
    }

    if (type === 'VARIABLE') {
      const name = current.data?.name;
      if (name) vars[name] = current.data?.fromInput ? (input ?? '') : (current.data?.value ?? '');
      current = nextNode(graph, current.id);
      continue;
    }

    if (type === 'DELAY') {
      actions.push({ kind: 'delay', ms: current.data?.ms ?? 1000 });
      current = nextNode(graph, current.id);
      continue;
    }

    if (type === 'AI') {
      actions.push({ kind: 'ai', prompt: current.data?.prompt, nodeId: current.id });
      current = nextNode(graph, current.id);
      continue;
    }

    if (type === 'WEBHOOK_CALL') {
      actions.push({ kind: 'webhook_call' });
      current = nextNode(graph, current.id);
      continue;
    }

    if (type === 'ASSIGN_AGENT') {
      actions.push({ kind: 'assign_agent' });
      status = 'COMPLETED';
      current = null;
      break;
    }

    if (type === 'END') {
      status = 'COMPLETED';
      current = null;
      break;
    }

    // tipo desconhecido: encerra defensivamente
    status = 'FAILED';
    break;
  }

  return {
    messages,
    actions,
    state: {
      currentNodeId: waiting ? (current?.id ?? null) : null,
      variables: vars,
      waitingForInput: waiting,
    },
    status,
  };
}

export const flowEngine = { advance, interpolate };
