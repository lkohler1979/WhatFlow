import { Component, output } from '@angular/core';
import { CdkDrag } from '@angular/cdk/drag-drop';
import { NODE_META, PALETTE_TYPES, type NodeType } from './flows.models';

/**
 * Paleta de tipos de nó.
 *
 * - Clicar adiciona um nó com posição padrão (caminho confiável).
 * - Arrastar para o canvas adiciona na posição solta — o canvas é o
 *   `cdkDropList` que escuta o drop; a paleta apenas emite `dragType` no
 *   início do arraste para o builder saber qual tipo está vindo.
 */
@Component({
  selector: 'wf-node-palette',
  standalone: true,
  imports: [CdkDrag],
  template: `
    <aside class="palette">
      <h2>Nós</h2>
      <p class="hint">Clique ou arraste para o canvas</p>
      @for (t of types; track t) {
        <button
          class="item"
          type="button"
          [attr.data-cy]="'palette-' + t"
          cdkDrag
          [cdkDragData]="t"
          (cdkDragStarted)="dragType.emit(t)"
          (click)="addNode.emit(t)"
        >
          <span class="dot" [style.background]="meta(t).color"></span>
          {{ meta(t).label }}
          <div class="drag-preview" *cdkDragPreview>
            <span class="dot" [style.background]="meta(t).color"></span>
            {{ meta(t).label }}
          </div>
        </button>
      }
    </aside>
  `,
  styles: [
    `
      .palette {
        width: 170px;
        flex-shrink: 0;
        padding: 0.75rem;
        background: #fff;
        border-right: 1px solid #e2e8f0;
        overflow-y: auto;
      }
      h2 {
        font-size: 0.85rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #64748b;
        margin-bottom: 0.25rem;
      }
      .hint {
        font-size: 0.7rem;
        color: #94a3b8;
        margin-bottom: 0.5rem;
      }
      .item,
      .drag-preview {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        width: 100%;
        padding: 0.45rem 0.55rem;
        margin-bottom: 0.35rem;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        background: #f8fafc;
        font: inherit;
        font-size: 0.8rem;
        text-align: left;
        cursor: grab;
      }
      .item:hover {
        background: #eef2ff;
        border-color: #c7d2fe;
      }
      .drag-preview {
        background: #fff;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
        cursor: grabbing;
      }
      .dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex-shrink: 0;
      }
    `,
  ],
})
export class NodePaletteComponent {
  types = PALETTE_TYPES;
  addNode = output<NodeType>();
  dragType = output<NodeType>();

  meta(t: NodeType) {
    return NODE_META[t];
  }
}
