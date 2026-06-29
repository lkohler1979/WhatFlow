export type NodeType =
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

export type TriggerType = 'KEYWORD' | 'ANY_MESSAGE' | 'FIRST_MESSAGE' | 'SCHEDULE';

export type FlowStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface FlowNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  label?: string | null;
}

export interface Flow {
  id: string;
  tenantId: string;
  instanceId: string | null;
  name: string;
  description: string | null;
  triggerType: TriggerType;
  triggerValue: string | null;
  nodesJson: FlowNode[];
  edgesJson: FlowEdge[];
  status: FlowStatus;
  version: number;
  publishedAt: string | null;
  isActive: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFlowBody {
  name: string;
  description?: string;
  instanceId?: string;
  triggerType: TriggerType;
  triggerValue?: string;
  nodesJson: FlowNode[];
  edgesJson: FlowEdge[];
}

export type UpdateFlowBody = Partial<CreateFlowBody>;

/** Metadados de apresentação por tipo de nó (rótulo + cor da barra). */
export const NODE_META: Record<NodeType, { label: string; color: string }> = {
  TEXT: { label: 'Texto', color: '#2563eb' },
  IMAGE: { label: 'Imagem', color: '#7c3aed' },
  AUDIO: { label: 'Áudio', color: '#7c3aed' },
  VIDEO: { label: 'Vídeo', color: '#7c3aed' },
  DOCUMENT: { label: 'Documento', color: '#7c3aed' },
  MENU: { label: 'Menu', color: '#d97706' },
  CONDITION: { label: 'Condição', color: '#0891b2' },
  DELAY: { label: 'Espera', color: '#65a30d' },
  VARIABLE: { label: 'Variável', color: '#65a30d' },
  WEBHOOK_CALL: { label: 'Webhook', color: '#475569' },
  AI: { label: 'IA', color: '#db2777' },
  ASSIGN_AGENT: { label: 'Atendente', color: '#475569' },
  END: { label: 'Fim', color: '#dc2626' },
};

/** Tipos oferecidos na paleta (ordem de exibição). */
export const PALETTE_TYPES: NodeType[] = [
  'TEXT',
  'IMAGE',
  'MENU',
  'CONDITION',
  'DELAY',
  'VARIABLE',
  'WEBHOOK_CALL',
  'AI',
  'ASSIGN_AGENT',
  'END',
];
