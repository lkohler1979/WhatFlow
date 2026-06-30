import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { FlowsService } from './flows.service';
import { FlowCanvasComponent } from './flow-canvas.component';
import { NodePaletteComponent } from './node-palette.component';
import { NodePropsComponent } from './node-props.component';
import { deriveVariables } from './flows.variables';
import {
  type Flow,
  type FlowEdge,
  type FlowNode,
  type FlowStatus,
  type NodeType,
  type TriggerType,
} from './flows.models';

const TRIGGER_TYPES: TriggerType[] = ['KEYWORD', 'ANY_MESSAGE', 'FIRST_MESSAGE', 'SCHEDULE'];

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Editor visual de fluxo (peça central do T-023).
 *
 * Carrega o fluxo (GET /:id), mantém nós/arestas em signals e persiste via
 * PATCH /:id (nodesJson + edgesJson, incluindo position → layout). Publica via
 * POST /:id/publish e trata 409 FLOW_IMMUTABLE orientando a duplicar.
 *
 * Painel de propriedades é MÍNIMO de propósito (texto do nó TEXT + gatilho).
 * Ponto de extensão para T-024: o `selectedNode()` expõe o nó selecionado;
 * basta renderizar o formulário por tipo nesse bloco e chamar `patchNodeData()`.
 */
@Component({
  selector: 'wf-flow-builder',
  standalone: true,
  imports: [ReactiveFormsModule, FlowCanvasComponent, NodePaletteComponent, NodePropsComponent],
  template: `
    <section class="builder">
      <header class="topbar">
        <button class="wf-btn" data-cy="back-to-flows" (click)="back()">← Fluxos</button>
        @if (flow(); as f) {
          <input
            class="wf-input name"
            data-cy="flow-name"
            [value]="f.name"
            (change)="onNameChange($event)"
            [disabled]="!editable()"
          />
          <span class="badge" [class]="'st-' + f.status">{{ statusLabel(f.status) }}</span>
        }
        <span class="spacer"></span>
        @if (saving()) {
          <span class="muted">Salvando...</span>
        } @else if (savedAt()) {
          <span class="ok">Salvo ✓</span>
        }
        @if (dirty() && editable()) {
          <span class="muted">Alterações não salvas</span>
        }
        <button
          class="wf-btn wf-btn--primary"
          data-cy="save-flow"
          (click)="save()"
          [disabled]="!editable() || saving() || !dirty()"
        >
          Salvar
        </button>
        <button
          class="wf-btn"
          data-cy="publish-flow"
          (click)="publish()"
          [disabled]="!editable() || saving()"
        >
          Publicar
        </button>
      </header>

      @if (error()) {
        <p class="error bar">{{ error() }}</p>
      }
      @if (!editable() && flow()) {
        <p class="warn bar">
          Fluxo publicado é imutável. Use
          <button class="link" data-cy="duplicate-flow" (click)="duplicate()">Duplicar</button>
          para criar um rascunho editável.
        </p>
      }

      @if (loading()) {
        <p class="muted pad">Carregando fluxo...</p>
      } @else if (flow()) {
        <div class="workspace">
          <wf-node-palette (addNode)="addNode($event)" (dragType)="pendingType.set($event)" />

          <div
            class="canvas-wrap"
            data-cy="flow-canvas-wrap"
            (drop)="onCanvasDrop($event)"
            (dragover)="$event.preventDefault()"
          >
            <wf-flow-canvas
              [nodes]="nodes()"
              [edges]="edges()"
              [selectedId]="selectedId()"
              (nodeMoved)="onNodeMoved($event)"
              (edgeAdded)="onEdgeAdded($event)"
              (removeEdge)="onRemoveEdge($event)"
              (removeNode)="onRemoveNode($event)"
              (nodeSelected)="selectedId.set($event)"
            />
          </div>

          <!-- Painel de propriedades por tipo (T-024) -->
          <aside class="props">
            @if (selectedNode(); as n) {
              <div class="props-head">
                <h2>Propriedades do nó</h2>
                <button
                  class="link"
                  data-cy="show-flow-props"
                  type="button"
                  (click)="selectedId.set(null)"
                >
                  Ver fluxo
                </button>
              </div>
              <wf-node-props
                [node]="n"
                [readonly]="!editable()"
                [variables]="variables()"
                (patch)="patchNodeData(selectedId(), $event)"
              />
            } @else {
              <h2>Propriedades do fluxo</h2>

              <div class="group">
                <label>Gatilho</label>
                <select
                  data-cy="flow-trigger"
                  [formControl]="triggerCtrl"
                  [class.disabled]="!editable()"
                >
                  @for (t of triggerTypes; track t) {
                    <option [value]="t">{{ triggerLabel(t) }}</option>
                  }
                </select>
              </div>

              @if (triggerCtrl.value === 'KEYWORD') {
                <div class="group">
                  <label>Palavra-chave</label>
                  <input
                    class="wf-input"
                    data-cy="flow-trigger-value"
                    type="text"
                    [formControl]="triggerValueCtrl"
                    placeholder="ex.: oi, menu, comprar"
                  />
                  <p class="muted small">Aciona o fluxo quando a mensagem contém o termo.</p>
                </div>
              }

              <p class="muted small">Selecione um nó no canvas para editar suas propriedades.</p>
            }
          </aside>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .builder {
        display: flex;
        flex-direction: column;
        height: calc(100vh - 64px);
      }
      .topbar {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.6rem 1rem;
        border-bottom: 1px solid #e2e8f0;
        background: #fff;
        flex-wrap: wrap;
      }
      .name {
        width: auto;
        min-width: 220px;
        font-weight: 600;
      }
      .spacer {
        flex: 1;
      }
      .workspace {
        flex: 1;
        display: flex;
        min-height: 0;
      }
      .canvas-wrap {
        flex: 1;
        min-width: 0;
      }
      .props {
        width: 288px;
        flex-shrink: 0;
        padding: 0.9rem;
        border-left: 1px solid #e2e8f0;
        background: #fff;
        overflow-y: auto;
      }
      .props h2 {
        font-size: 0.85rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #64748b;
        margin-bottom: 0.75rem;
      }
      .props-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 0.5rem;
      }
      .props-head h2 {
        margin-bottom: 0.5rem;
      }
      .props-head .link {
        font-size: 0.72rem;
      }
      .group {
        margin-bottom: 1rem;
      }
      .group label {
        display: block;
        font-size: 0.75rem;
        font-weight: 600;
        margin-bottom: 0.25rem;
        color: #334155;
      }
      .props select,
      .props textarea {
        width: 100%;
        padding: 0.45rem 0.55rem;
        border: 1px solid #d0d5dd;
        border-radius: 8px;
        font: inherit;
        font-size: 0.85rem;
      }
      .badge {
        font-size: 0.7rem;
        padding: 0.15rem 0.5rem;
        border-radius: 999px;
        background: #eee;
      }
      .st-PUBLISHED {
        background: #d1fae5;
        color: #065f46;
      }
      .st-DRAFT {
        background: #fef3c7;
        color: #92400e;
      }
      .st-ARCHIVED {
        background: #e5e7eb;
        color: #374151;
      }
      .muted {
        opacity: 0.65;
      }
      .small {
        font-size: 0.78rem;
      }
      .ok {
        color: #065f46;
        font-size: 0.8rem;
      }
      .error {
        color: #b42318;
      }
      .bar {
        margin: 0;
        padding: 0.5rem 1rem;
      }
      .warn {
        background: #fffbeb;
        color: #92400e;
        font-size: 0.85rem;
      }
      .pad {
        padding: 1rem;
      }
      .link {
        background: none;
        border: 0;
        color: #2563eb;
        cursor: pointer;
        text-decoration: underline;
        font: inherit;
      }
    `,
  ],
})
export class FlowBuilderComponent implements OnInit {
  private svc = inject(FlowsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  triggerTypes = TRIGGER_TYPES;

  flow = signal<Flow | null>(null);
  nodes = signal<FlowNode[]>([]);
  edges = signal<FlowEdge[]>([]);
  selectedId = signal<string | null>(null);

  loading = signal(true);
  saving = signal(false);
  dirty = signal(false);
  savedAt = signal<number | null>(null);
  error = signal<string | null>(null);

  pendingType = signal<NodeType | null>(null);

  triggerCtrl = this.fb.nonNullable.control<TriggerType>('KEYWORD');
  triggerValueCtrl = this.fb.nonNullable.control<string>('');

  editable = computed(() => this.flow()?.status === 'DRAFT');
  selectedNode = computed(() => {
    const id = this.selectedId();
    return id ? (this.nodes().find(n => n.id === id) ?? null) : null;
  });

  /**
   * Variáveis conhecidas do fluxo (T-025): sistema + nós VARIABLE do grafo.
   * Derivada aqui (fonte de verdade) e injetada no painel de propriedades.
   */
  variables = computed(() => deriveVariables(this.nodes()));

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Fluxo não informado');
      this.loading.set(false);
      return;
    }
    this.svc.get(id).subscribe({
      next: f => {
        this.flow.set(f);
        this.nodes.set(Array.isArray(f.nodesJson) ? f.nodesJson : []);
        this.edges.set(Array.isArray(f.edgesJson) ? f.edgesJson : []);
        this.triggerCtrl.setValue(f.triggerType, { emitEvent: false });
        this.triggerValueCtrl.setValue(f.triggerValue ?? '', { emitEvent: false });
        if (f.status !== 'DRAFT') {
          this.triggerCtrl.disable({ emitEvent: false });
          this.triggerValueCtrl.disable({ emitEvent: false });
        }
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Falha ao carregar fluxo');
        this.loading.set(false);
      },
    });

    this.triggerCtrl.valueChanges.subscribe(() => this.markDirty());
    this.triggerValueCtrl.valueChanges.subscribe(() => this.markDirty());
  }

  triggerLabel(t: TriggerType): string {
    return {
      KEYWORD: 'Palavra-chave',
      ANY_MESSAGE: 'Qualquer mensagem',
      FIRST_MESSAGE: 'Primeira mensagem',
      SCHEDULE: 'Agendado',
    }[t];
  }

  statusLabel(s: FlowStatus): string {
    return { DRAFT: 'Rascunho', PUBLISHED: 'Publicado', ARCHIVED: 'Arquivado' }[s];
  }

  private markDirty(): void {
    this.dirty.set(true);
    this.savedAt.set(null);
  }

  // --- Edição de nós/arestas ---

  addNode(type: NodeType, position?: { x: number; y: number }): void {
    if (!this.editable()) return;
    const pos = position ?? { x: 60 + this.nodes().length * 24, y: 60 + this.nodes().length * 24 };
    const node: FlowNode = {
      id: uid('node'),
      type,
      position: pos,
      data: type === 'MENU' ? { options: [] } : {},
    };
    this.nodes.update(list => [...list, node]);
    this.selectedId.set(node.id);
    this.markDirty();
  }

  onCanvasDrop(ev: DragEvent): void {
    ev.preventDefault();
    const type = this.pendingType();
    if (!type || !this.editable()) return;
    const target = ev.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const x = Math.max(0, Math.round(ev.clientX - rect.left + target.scrollLeft - 90));
    const y = Math.max(0, Math.round(ev.clientY - rect.top + target.scrollTop - 38));
    this.addNode(type, { x, y });
    this.pendingType.set(null);
  }

  onNodeMoved(e: { id: string; x: number; y: number }): void {
    this.nodes.update(list =>
      list.map(n => (n.id === e.id ? { ...n, position: { x: e.x, y: e.y } } : n)),
    );
    this.markDirty();
  }

  onEdgeAdded(e: Omit<FlowEdge, 'id'>): void {
    if (!this.editable()) return;
    // evita duplicar a mesma origem/alça → destino
    const exists = this.edges().some(
      x => x.source === e.source && x.target === e.target && x.sourceHandle === e.sourceHandle,
    );
    if (exists) return;
    this.edges.update(list => [...list, { id: uid('edge'), ...e }]);
    this.markDirty();
  }

  onRemoveEdge(id: string): void {
    if (!this.editable()) return;
    this.edges.update(list => list.filter(x => x.id !== id));
    this.markDirty();
  }

  onRemoveNode(id: string): void {
    if (!this.editable()) return;
    this.nodes.update(list => list.filter(n => n.id !== id));
    this.edges.update(list => list.filter(e => e.source !== id && e.target !== id));
    if (this.selectedId() === id) this.selectedId.set(null);
    this.markDirty();
  }

  onNameChange(ev: Event): void {
    const name = (ev.target as HTMLInputElement).value.trim();
    const f = this.flow();
    if (f && name) {
      this.flow.set({ ...f, name });
      this.markDirty();
    }
  }

  /** Atualiza `data` do nó por id, mantendo imutabilidade e marcando dirty. */
  patchNodeData(id: string | null, patch: Record<string, unknown>): void {
    if (!id || !this.editable()) return;
    this.nodes.update(list =>
      list.map(n => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
    );
    this.markDirty();
  }

  // --- Persistência ---

  save(): void {
    const f = this.flow();
    if (!f || !this.editable()) return;
    this.saving.set(true);
    this.error.set(null);
    this.svc
      .update(f.id, {
        name: f.name,
        triggerType: this.triggerCtrl.value,
        triggerValue: this.triggerCtrl.value === 'KEYWORD' ? this.triggerValueCtrl.value : '',
        nodesJson: this.nodes(),
        edgesJson: this.edges(),
      })
      .subscribe({
        next: updated => {
          this.flow.set(updated);
          this.saving.set(false);
          this.dirty.set(false);
          this.savedAt.set(Date.now());
        },
        error: (e: { status?: number; error?: { code?: string; message?: string } }) => {
          this.saving.set(false);
          if (e?.status === 409 || e?.error?.code === 'FLOW_IMMUTABLE') {
            this.error.set('Fluxo publicado é imutável. Duplique para editar.');
          } else {
            this.error.set(e?.error?.message ?? 'Falha ao salvar');
          }
        },
      });
  }

  publish(): void {
    const f = this.flow();
    if (!f || !this.editable()) return;
    if (this.dirty()) {
      this.error.set('Salve as alterações antes de publicar.');
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.svc.publish(f.id).subscribe({
      next: updated => {
        this.flow.set(updated);
        this.triggerCtrl.disable({ emitEvent: false });
        this.saving.set(false);
      },
      error: (e: { error?: { message?: string } }) => {
        this.saving.set(false);
        this.error.set(e?.error?.message ?? 'Falha ao publicar');
      },
    });
  }

  duplicate(): void {
    const f = this.flow();
    if (!f) return;
    this.svc.duplicate(f.id).subscribe({
      next: copy => void this.router.navigate(['/flows', copy.id]),
      error: (e: { error?: { message?: string } }) =>
        this.error.set(e?.error?.message ?? 'Falha ao duplicar'),
    });
  }

  back(): void {
    void this.router.navigate(['/flows']);
  }
}
