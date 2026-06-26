/**
 * Tipos do grafo de fluxo (persistidos em Flow.nodesJson / Flow.edgesJson)
 * e do estado de sessão (FlowSession). O FlowEngine é puro: recebe grafo +
 * estado + input e devolve mensagens/ações + próximo estado.
 */

export type FlowNodeType =
  | 'TEXT'
  | 'IMAGE'
  | 'AUDIO'
  | 'VIDEO'
  | 'DOCUMENT'
  | 'MENU'
  | 'CONDITION'
  | 'DELAY'
  | 'VARIABLE'
  | 'WEBHOOK_CALL'
  | 'AI'
  | 'ASSIGN_AGENT'
  | 'END';

export interface MenuOption {
  id: string;
  label: string;
}

export interface FlowNodeData {
  /** TEXT/IMAGE/...: conteúdo (suporta {{variaveis}}) */
  text?: string;
  /** mídia */
  mediaUrl?: string;
  /** MENU */
  options?: MenuOption[];
  /** CONDITION */
  variable?: string;
  operator?: 'eq' | 'neq' | 'contains' | 'gt' | 'lt';
  value?: string;
  /** VARIABLE: nome do destino; se fromInput, captura a última mensagem do usuário */
  name?: string;
  fromInput?: boolean;
  /** DELAY (ms) */
  ms?: number;
  /** AI / outros: prompt etc. */
  prompt?: string;
}

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  data?: FlowNodeData;
}

export interface FlowEdge {
  source: string;
  target: string;
  /** identifica a saída: 'out' (padrão), id da opção (MENU), 'true'/'false' (CONDITION) */
  sourceHandle?: string;
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface SessionState {
  currentNodeId: string | null;
  variables: Record<string, unknown>;
  waitingForInput: boolean;
}

export type OutboundMessageType = 'text' | 'image' | 'audio' | 'video' | 'document';

export interface OutboundMessage {
  type: OutboundMessageType;
  text?: string;
  mediaUrl?: string;
}

export type EngineAction =
  | { kind: 'delay'; ms: number }
  | { kind: 'assign_agent' }
  | { kind: 'webhook_call' }
  | { kind: 'ai'; prompt?: string; nodeId: string };

export type EngineStatus = 'WAITING' | 'COMPLETED' | 'FAILED';

export interface EngineResult {
  messages: OutboundMessage[];
  actions: EngineAction[];
  state: SessionState;
  status: EngineStatus;
}
