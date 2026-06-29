import {
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CdkDrag, CdkDragEnd, CdkDragMove } from '@angular/cdk/drag-drop';
import type { FlowEdge, FlowNode } from './flows.models';
import { NODE_META } from './flows.models';

interface EdgePath {
  edge: FlowEdge;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  midX: number;
  midY: number;
}

const NODE_W = 180;
const NODE_H = 76;

/**
 * Canvas do editor de fluxos.
 *
 * - Nós são cards posicionados em coordenadas absolutas (node.position.x/y).
 * - Arrastar um card (CDK drag, livre) atualiza a posição via `nodeMoved`.
 * - Conexão: clicar na alça de saída ("out"/opção/true/false) entra em modo
 *   "ligando"; clicar na alça de entrada de outro nó cria a aresta via `edgeAdded`.
 * - Arestas desenhadas em SVG sobreposto (atrás dos cards).
 */
@Component({
  selector: 'wf-flow-canvas',
  standalone: true,
  imports: [CdkDrag],
  template: `
    <div class="canvas" #canvas>
      <svg class="edges" [attr.width]="'100%'" [attr.height]="'100%'">
        @for (p of edgePaths(); track p.edge.id) {
          <g class="edge">
            <path
              [attr.d]="pathD(p)"
              fill="none"
              stroke="#94a3b8"
              stroke-width="2"
              marker-end="url(#arrow)"
            />
            <circle
              class="edge-del"
              [attr.cx]="p.midX"
              [attr.cy]="p.midY"
              r="9"
              (click)="removeEdge.emit(p.edge.id)"
            />
            <text
              class="edge-del-x"
              [attr.x]="p.midX"
              [attr.y]="p.midY + 3"
              text-anchor="middle"
              (click)="removeEdge.emit(p.edge.id)"
            >
              ×
            </text>
          </g>
        }
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#94a3b8" />
          </marker>
        </defs>
      </svg>

      @for (node of nodes(); track node.id) {
        <div
          class="node"
          cdkDrag
          [cdkDragFreeDragPosition]="{ x: node.position.x, y: node.position.y }"
          (cdkDragMoved)="onDragMove(node, $event)"
          (cdkDragEnded)="onDragEnd(node, $event)"
          [class.selected]="node.id === selectedId()"
          (click)="nodeSelected.emit(node.id)"
        >
          <div class="node-bar" [style.background]="meta(node).color">
            <span class="node-type">{{ meta(node).label }}</span>
            <button class="node-del" type="button" (click)="onRemoveNode($event, node.id)">
              ×
            </button>
          </div>
          <div class="node-body">{{ summary(node) }}</div>

          <!-- alça de entrada -->
          <button
            class="handle handle-in"
            type="button"
            title="Entrada"
            (click)="onTargetClick($event, node.id)"
          ></button>

          <!-- alças de saída -->
          @for (h of outHandles(node); track h.id) {
            <button
              class="handle handle-out"
              type="button"
              [title]="h.label"
              [class.active]="isConnecting(node.id, h.id)"
              (click)="onSourceClick($event, node.id, h.id)"
            >
              @if (h.label !== 'out') {
                <span class="handle-lbl">{{ h.label }}</span>
              }
            </button>
          }
        </div>
      }

      @if (connecting()) {
        <p class="hint">Clique na entrada (○) de outro nó para conectar — ou ESC para cancelar.</p>
      }
    </div>
  `,
  styles: [
    `
      .canvas {
        position: relative;
        width: 100%;
        height: 100%;
        min-height: 420px;
        overflow: auto;
        background: #f8fafc;
        background-image: radial-gradient(#e2e8f0 1px, transparent 1px);
        background-size: 20px 20px;
      }
      .edges {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }
      .edges .edge-del,
      .edges .edge-del-x {
        pointer-events: all;
        cursor: pointer;
      }
      .edge-del {
        fill: #fff;
        stroke: #cbd5e1;
      }
      .edge-del-x {
        fill: #dc2626;
        font-size: 14px;
        font-weight: 700;
        user-select: none;
      }
      .node {
        position: absolute;
        width: 180px;
        min-height: 76px;
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        cursor: grab;
        user-select: none;
      }
      .node.selected {
        border-color: #2563eb;
        box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.3);
      }
      .node:active {
        cursor: grabbing;
      }
      .node-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.3rem 0.5rem;
        border-radius: 10px 10px 0 0;
        color: #fff;
      }
      .node-type {
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.02em;
      }
      .node-del {
        background: rgba(255, 255, 255, 0.25);
        border: 0;
        color: #fff;
        width: 18px;
        height: 18px;
        border-radius: 4px;
        cursor: pointer;
        line-height: 1;
      }
      .node-body {
        padding: 0.5rem;
        font-size: 0.78rem;
        color: #334155;
        word-break: break-word;
      }
      .handle {
        position: absolute;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        border: 2px solid #94a3b8;
        background: #fff;
        cursor: crosshair;
        padding: 0;
      }
      .handle-in {
        left: -9px;
        top: 50%;
        transform: translateY(-50%);
      }
      .handle-out {
        right: -9px;
        top: 50%;
        transform: translateY(-50%);
      }
      .handle-out .handle-lbl {
        position: absolute;
        left: 18px;
        top: -3px;
        font-size: 0.6rem;
        color: #475569;
        white-space: nowrap;
        background: #fff;
        padding: 0 2px;
      }
      .handle.active {
        background: #2563eb;
        border-color: #2563eb;
      }
      .hint {
        position: sticky;
        bottom: 8px;
        margin: 8px;
        display: inline-block;
        background: #1e293b;
        color: #fff;
        font-size: 0.75rem;
        padding: 0.4rem 0.7rem;
        border-radius: 6px;
      }
    `,
  ],
})
export class FlowCanvasComponent {
  nodes = input.required<FlowNode[]>();
  edges = input.required<FlowEdge[]>();
  selectedId = input<string | null>(null);

  nodeMoved = output<{ id: string; x: number; y: number }>();
  edgeAdded = output<Omit<FlowEdge, 'id'>>();
  removeEdge = output<string>();
  removeNode = output<string>();
  nodeSelected = output<string>();

  private canvasRef = viewChild<ElementRef<HTMLElement>>('canvas');

  /** Estado da conexão em andamento: nó de origem + alça. */
  private connectFrom = signal<{ source: string; handle: string } | null>(null);
  connecting = computed(() => this.connectFrom() !== null);

  /** Posições "ao vivo" durante o arraste, para mover as arestas junto. */
  private livePos = signal<Record<string, { x: number; y: number }>>({});

  meta(node: FlowNode) {
    return NODE_META[node.type];
  }

  summary(node: FlowNode): string {
    const d = node.data;
    if (node.type === 'TEXT' && typeof d['text'] === 'string') {
      return (d['text'] as string) || '(texto vazio)';
    }
    if (node.type === 'CONDITION') return 'true / false';
    if (node.type === 'END') return 'Encerrar fluxo';
    return NODE_META[node.type].label;
  }

  /** Alças de saída por tipo de nó. */
  outHandles(node: FlowNode): { id: string; label: string }[] {
    if (node.type === 'END') return [];
    if (node.type === 'CONDITION') {
      return [
        { id: 'true', label: 'true' },
        { id: 'false', label: 'false' },
      ];
    }
    if (node.type === 'MENU' && Array.isArray(node.data['options'])) {
      const opts = node.data['options'] as { id?: string; label?: string }[];
      if (opts.length) {
        return opts.map((o, i) => ({
          id: o.id ?? String(i),
          label: o.label ?? `Opção ${i + 1}`,
        }));
      }
    }
    return [{ id: 'out', label: 'out' }];
  }

  isConnecting(source: string, handle: string): boolean {
    const c = this.connectFrom();
    return !!c && c.source === source && c.handle === handle;
  }

  private posOf(node: FlowNode): { x: number; y: number } {
    return this.livePos()[node.id] ?? node.position;
  }

  /** Índice da alça de saída (para distribuir verticalmente no card). */
  private outIndex(node: FlowNode, handle: string): { index: number; total: number } {
    const handles = this.outHandles(node);
    const index = Math.max(
      0,
      handles.findIndex(h => h.id === handle),
    );
    return { index, total: handles.length || 1 };
  }

  edgePaths = computed<EdgePath[]>(() => {
    const byId = new Map(this.nodes().map(n => [n.id, n]));
    const paths: EdgePath[] = [];
    for (const edge of this.edges()) {
      const src = byId.get(edge.source);
      const tgt = byId.get(edge.target);
      if (!src || !tgt) continue;
      const sp = this.posOf(src);
      const tp = this.posOf(tgt);
      const { index, total } = this.outIndex(src, edge.sourceHandle ?? 'out');
      const sy = sp.y + (NODE_H * (index + 1)) / (total + 1);
      const x1 = sp.x + NODE_W;
      const y1 = sy;
      const x2 = tp.x;
      const y2 = tp.y + NODE_H / 2;
      paths.push({
        edge,
        x1,
        y1,
        x2,
        y2,
        midX: (x1 + x2) / 2,
        midY: (y1 + y2) / 2,
      });
    }
    return paths;
  });

  pathD(p: EdgePath): string {
    const dx = Math.max(40, Math.abs(p.x2 - p.x1) / 2);
    return `M ${p.x1} ${p.y1} C ${p.x1 + dx} ${p.y1}, ${p.x2 - dx} ${p.y2}, ${p.x2} ${p.y2}`;
  }

  onDragMove(node: FlowNode, ev: CdkDragMove): void {
    this.livePos.update(m => ({
      ...m,
      [node.id]: { x: node.position.x + ev.distance.x, y: node.position.y + ev.distance.y },
    }));
  }

  onDragEnd(node: FlowNode, ev: CdkDragEnd): void {
    const x = node.position.x + ev.distance.x;
    const y = node.position.y + ev.distance.y;
    this.livePos.update(m => {
      const next = { ...m };
      delete next[node.id];
      return next;
    });
    this.nodeMoved.emit({ id: node.id, x: Math.round(x), y: Math.round(y) });
  }

  onRemoveNode(ev: Event, id: string): void {
    ev.stopPropagation();
    this.removeNode.emit(id);
  }

  onSourceClick(ev: Event, source: string, handle: string): void {
    ev.stopPropagation();
    const cur = this.connectFrom();
    if (cur && cur.source === source && cur.handle === handle) {
      this.connectFrom.set(null);
    } else {
      this.connectFrom.set({ source, handle });
    }
  }

  onTargetClick(ev: Event, target: string): void {
    ev.stopPropagation();
    const from = this.connectFrom();
    if (!from) return;
    if (from.source === target) {
      this.connectFrom.set(null);
      return;
    }
    this.edgeAdded.emit({
      source: from.source,
      target,
      sourceHandle: from.handle,
      label: from.handle === 'out' ? null : from.handle,
    });
    this.connectFrom.set(null);
  }
}
