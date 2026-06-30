import { Component, computed, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { FlowNode, NodeType } from './flows.models';
import { NODE_META } from './flows.models';
import { type VarInfo, interpolateSamples, unknownVariables } from './flows.variables';

interface MenuOption {
  id: string;
  label: string;
}

type Operator = 'eq' | 'neq' | 'contains' | 'gt' | 'lt';

const OPERATORS: { value: Operator; label: string }[] = [
  { value: 'eq', label: '= igual a' },
  { value: 'neq', label: '≠ diferente de' },
  { value: 'contains', label: '⊃ contém' },
  { value: 'gt', label: '> maior que' },
  { value: 'lt', label: '< menor que' },
];

const MEDIA_TYPES: NodeType[] = ['IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT'];

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Painel de propriedades por TIPO de nó (T-024) + variáveis dinâmicas (T-025).
 *
 * Recebe o nó selecionado via `node` (input) e emite alterações de `data`
 * via `patch` (output) — o builder repassa a `patchNodeData(selectedId, patch)`,
 * mantendo a imutabilidade e o `dirty`. Como o nó vem por input, trocar a
 * seleção recarrega os valores automaticamente (sem estado interno duplicado).
 *
 * T-025: nos campos interpoláveis (TEXT.text, AI.prompt, MENU.text, legenda de
 * mídia) há um seletor de variáveis (chips). Clicar insere `{{nome}}` na posição
 * do cursor do campo. Abaixo do campo, um preview mostra o texto com as
 * variáveis substituídas pelos valores de exemplo, e um aviso lista variáveis
 * desconhecidas. A lista de variáveis chega pronta via `variables` (input),
 * derivada pelo builder a partir do grafo. Persiste sempre o texto cru.
 */
@Component({
  selector: 'wf-node-props',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `
    @if (node(); as n) {
      <div class="group">
        <label>Nó selecionado</label>
        <p class="muted small">{{ meta(n.type).label }} — {{ n.id }}</p>
      </div>

      @switch (n.type) {
        @case ('TEXT') {
          <div class="group">
            <label>Texto</label>
            <textarea
              #f
              data-cy="node-text"
              rows="4"
              [value]="str(n, 'text')"
              (input)="onInterpInput('text', $event)"
              (focus)="rememberField($event)"
              (select)="rememberField($event)"
              (click)="rememberField($event)"
              (keyup)="rememberField($event)"
              [disabled]="ro()"
              placeholder="Mensagem (use {{ '{{variavel}}' }} para interpolar)"
            ></textarea>
            <ng-container
              *ngTemplateOutlet="varTools; context: { $implicit: str(n, 'text'), field: f }"
            />
          </div>
        }

        @case ('AI') {
          <div class="group">
            <label>Prompt da IA</label>
            <textarea
              #f
              data-cy="node-ai-prompt"
              rows="5"
              [value]="str(n, 'prompt')"
              (input)="onInterpInput('prompt', $event)"
              (focus)="rememberField($event)"
              (select)="rememberField($event)"
              (click)="rememberField($event)"
              (keyup)="rememberField($event)"
              [disabled]="ro()"
              placeholder="Instrução enviada ao modelo (interpolável com {{ '{{var}}' }})"
            ></textarea>
            <ng-container
              *ngTemplateOutlet="varTools; context: { $implicit: str(n, 'prompt'), field: f }"
            />
          </div>
        }

        @case ('CONDITION') {
          <div class="group">
            <label>Variável</label>
            <input
              data-cy="condition-variable"
              type="text"
              [value]="str(n, 'variable')"
              (input)="patchField('variable', $event)"
              [disabled]="ro()"
              placeholder="ex.: opcao_selecionada"
            />
            @if (!str(n, 'variable')) {
              <p class="hint">Informe a variável a comparar.</p>
            }
          </div>
          <div class="group">
            <label>Operador</label>
            <select
              data-cy="condition-operator"
              [value]="str(n, 'operator') || 'eq'"
              (change)="patchField('operator', $event)"
              [disabled]="ro()"
            >
              @for (op of operators; track op.value) {
                <option [value]="op.value">{{ op.label }}</option>
              }
            </select>
          </div>
          <div class="group">
            <label>Valor</label>
            <input
              data-cy="condition-value"
              type="text"
              [value]="str(n, 'value')"
              (input)="patchField('value', $event)"
              [disabled]="ro()"
              placeholder="valor de comparação"
            />
          </div>
          <p class="muted small">Saídas: <strong>true</strong> / <strong>false</strong>.</p>
        }

        @case ('VARIABLE') {
          <div class="group">
            <label>Nome da variável</label>
            <input
              data-cy="variable-name"
              type="text"
              [value]="str(n, 'name')"
              (input)="patchField('name', $event)"
              [disabled]="ro()"
              placeholder="ex.: nome_cliente"
            />
            @if (!str(n, 'name')) {
              <p class="hint">Nome é obrigatório.</p>
            }
          </div>
          <div class="group">
            <label class="check">
              <input
                data-cy="variable-from-input"
                type="checkbox"
                [checked]="bool(n, 'fromInput')"
                (change)="patchFromInput($event)"
                [disabled]="ro()"
              />
              Vem da resposta do usuário
            </label>
          </div>
          @if (!bool(n, 'fromInput')) {
            <div class="group">
              <label>Valor estático</label>
              <input
                data-cy="variable-value"
                type="text"
                [value]="str(n, 'value')"
                (input)="patchField('value', $event)"
                [disabled]="ro()"
                placeholder="valor fixo"
              />
            </div>
          } @else {
            <p class="muted small">Grava a última mensagem recebida do contato.</p>
          }
        }

        @case ('MENU') {
          <div class="group">
            <label>Enunciado</label>
            <textarea
              #f
              data-cy="menu-text"
              rows="3"
              [value]="str(n, 'text')"
              (input)="onInterpInput('text', $event)"
              (focus)="rememberField($event)"
              (select)="rememberField($event)"
              (click)="rememberField($event)"
              (keyup)="rememberField($event)"
              [disabled]="ro()"
              placeholder="Pergunta do menu"
            ></textarea>
            <ng-container
              *ngTemplateOutlet="varTools; context: { $implicit: str(n, 'text'), field: f }"
            />
          </div>
          <div class="group">
            <label>Opções</label>
            @for (opt of options(); track opt.id; let i = $index) {
              <div class="opt-row">
                <span class="opt-num">{{ i + 1 }}</span>
                <input
                  data-cy="menu-option-label"
                  type="text"
                  [value]="opt.label"
                  (input)="onOptionLabel(i, $event)"
                  [disabled]="ro()"
                  placeholder="rótulo da opção"
                />
                <button
                  class="mini"
                  type="button"
                  (click)="moveOption(i, -1)"
                  [disabled]="ro() || i === 0"
                  title="Subir"
                >
                  ↑
                </button>
                <button
                  class="mini"
                  type="button"
                  (click)="moveOption(i, 1)"
                  [disabled]="ro() || i === options().length - 1"
                  title="Descer"
                >
                  ↓
                </button>
                <button
                  class="mini del"
                  type="button"
                  (click)="removeOption(i)"
                  [disabled]="ro()"
                  title="Remover"
                >
                  ×
                </button>
              </div>
            }
            <button
              class="wf-btn small-btn"
              data-cy="add-menu-option"
              type="button"
              (click)="addOption()"
              [disabled]="ro()"
            >
              + Adicionar opção
            </button>
            @if (!options().length) {
              <p class="hint">Adicione ao menos uma opção.</p>
            } @else if (hasEmptyLabel()) {
              <p class="hint">Toda opção precisa de um rótulo.</p>
            }
          </div>
        }

        @case ('DELAY') {
          <div class="group">
            <label>Espera (ms)</label>
            <input
              data-cy="delay-ms"
              type="number"
              min="0"
              step="100"
              [value]="num(n, 'ms', 1000)"
              (input)="patchNumber('ms', $event)"
              [disabled]="ro()"
            />
            <p class="muted small">{{ num(n, 'ms', 1000) }} ms ≈ {{ seconds() }} s</p>
          </div>
        }

        @case ('WEBHOOK_CALL') {
          <div class="group">
            <label>URL (uso futuro)</label>
            <input
              data-cy="webhook-url"
              type="text"
              [value]="str(n, 'url')"
              (input)="patchField('url', $event)"
              [disabled]="ro()"
              placeholder="https://..."
            />
          </div>
          <div class="group">
            <label>Método (uso futuro)</label>
            <select
              data-cy="webhook-method"
              [value]="str(n, 'method') || 'POST'"
              (change)="patchField('method', $event)"
              [disabled]="ro()"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>
          <p class="muted small">
            O motor emite a chamada; URL/método ainda não são consumidos (planejado).
          </p>
        }

        @case ('ASSIGN_AGENT') {
          <p class="muted small">
            Transfere a conversa para um atendente humano e encerra o fluxo automático. Sem campos a
            configurar.
          </p>
        }

        @case ('END') {
          <p class="muted small">Encerra o fluxo. Sem campos a configurar.</p>
        }

        @default {
          @if (isMedia(n.type)) {
            <div class="group">
              <label>URL da mídia</label>
              <input
                data-cy="media-url"
                type="text"
                [value]="str(n, 'mediaUrl')"
                (input)="patchField('mediaUrl', $event)"
                [disabled]="ro()"
                placeholder="https://... do arquivo"
              />
            </div>
            <div class="group">
              <label>Legenda (opcional)</label>
              <textarea
                #f
                data-cy="media-caption"
                rows="2"
                [value]="str(n, 'text')"
                (input)="onInterpInput('text', $event)"
                (focus)="rememberField($event)"
                (select)="rememberField($event)"
                (click)="rememberField($event)"
                (keyup)="rememberField($event)"
                [disabled]="ro()"
                placeholder="Texto que acompanha a mídia"
              ></textarea>
              <ng-container
                *ngTemplateOutlet="varTools; context: { $implicit: str(n, 'text'), field: f }"
              />
            </div>
          } @else {
            <p class="muted small">Este tipo de nó não possui campos configuráveis.</p>
          }
        }
      }
    }

    <!-- Ferramentas de variável reutilizáveis: chips + preview + aviso. -->
    <ng-template #varTools let-text let-field="field">
      @if (variables().length && !ro()) {
        <div class="var-bar">
          <span class="var-bar-label">Inserir variável:</span>
          @for (v of variables(); track v.name) {
            <button
              type="button"
              class="chip"
              (mousedown)="$event.preventDefault()"
              (click)="insertVar(field, v.name)"
              [title]="'Insere {{' + v.name + '}}'"
            >
              {{ v.name }}
            </button>
          }
        </div>
      }
      @if (text) {
        <div class="preview">
          <span class="preview-label">Preview:</span>
          <span class="preview-text">{{ preview(text) }}</span>
        </div>
        @if (badVars(text).length) {
          <p class="var-warn">
            @for (b of badVars(text); track b) {
              <span>Variável desconhecida: {{ '{{' + b + '}}' }}</span>
            }
          </p>
        }
      }
    </ng-template>
  `,
  styles: [
    `
      .group {
        margin-bottom: 1rem;
      }
      .group > label {
        display: block;
        font-size: 0.75rem;
        font-weight: 600;
        margin-bottom: 0.25rem;
        color: #334155;
      }
      label.check {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        font-weight: 500;
        cursor: pointer;
      }
      label.check input {
        width: auto;
      }
      input[type='text'],
      input[type='number'],
      select,
      textarea {
        width: 100%;
        padding: 0.45rem 0.55rem;
        border: 1px solid #d0d5dd;
        border-radius: 8px;
        font: inherit;
        font-size: 0.85rem;
        box-sizing: border-box;
      }
      .opt-row {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        margin-bottom: 0.35rem;
      }
      .opt-row input {
        flex: 1;
        min-width: 0;
      }
      .opt-num {
        font-size: 0.7rem;
        color: #64748b;
        width: 1rem;
        text-align: center;
        flex-shrink: 0;
      }
      .mini {
        border: 1px solid #d0d5dd;
        background: #fff;
        border-radius: 6px;
        width: 24px;
        height: 30px;
        cursor: pointer;
        flex-shrink: 0;
        line-height: 1;
      }
      .mini:disabled {
        opacity: 0.4;
        cursor: default;
      }
      .mini.del {
        color: #dc2626;
      }
      .small-btn {
        margin-top: 0.25rem;
        font-size: 0.8rem;
        padding: 0.35rem 0.6rem;
      }
      .muted {
        opacity: 0.65;
      }
      .small {
        font-size: 0.78rem;
      }
      .hint {
        margin: 0.25rem 0 0;
        font-size: 0.72rem;
        color: #b45309;
      }
      .var-bar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.3rem;
        margin-top: 0.4rem;
      }
      .var-bar-label {
        font-size: 0.7rem;
        color: #64748b;
      }
      .chip {
        border: 1px solid #c7d2fe;
        background: #eef2ff;
        color: #3730a3;
        border-radius: 999px;
        padding: 0.1rem 0.5rem;
        font-size: 0.72rem;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        cursor: pointer;
        line-height: 1.4;
      }
      .chip:hover {
        background: #e0e7ff;
      }
      .preview {
        margin-top: 0.4rem;
        padding: 0.4rem 0.5rem;
        background: #f8fafc;
        border: 1px dashed #cbd5e1;
        border-radius: 8px;
        font-size: 0.78rem;
      }
      .preview-label {
        font-size: 0.68rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #64748b;
        display: block;
        margin-bottom: 0.15rem;
      }
      .preview-text {
        white-space: pre-wrap;
        word-break: break-word;
        color: #0f172a;
      }
      .var-warn {
        margin: 0.3rem 0 0;
        font-size: 0.72rem;
        color: #b42318;
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
      }
    `,
  ],
})
export class NodePropsComponent {
  node = input.required<FlowNode | null>();
  readonly = input<boolean>(false);
  variables = input<VarInfo[]>([]);
  patch = output<Record<string, unknown>>();

  operators = OPERATORS;

  ro = computed(() => this.readonly());

  /** Campo de texto interpolável focado por último + posição do caret. */
  private focused: HTMLTextAreaElement | HTMLInputElement | null = null;
  /** Chave do campo focado (ex.: 'text' | 'prompt') para reemitir o patch. */
  private focusedKey = signal<string>('');

  options = computed<MenuOption[]>(() => {
    const n = this.node();
    const raw = n?.data?.['options'];
    if (!Array.isArray(raw)) return [];
    return (raw as { id?: string; label?: string }[]).map((o, i) => ({
      id: o.id ?? String(i),
      label: o.label ?? '',
    }));
  });

  hasEmptyLabel = computed(() => this.options().some(o => !o.label.trim()));

  seconds = computed(() => {
    const n = this.node();
    const ms = this.num(n, 'ms', 1000);
    return Math.round(ms / 100) / 10;
  });

  meta(t: NodeType) {
    return NODE_META[t];
  }

  isMedia(t: NodeType): boolean {
    return MEDIA_TYPES.includes(t);
  }

  str(n: FlowNode, key: string): string {
    const v = n.data?.[key];
    return typeof v === 'string' ? v : '';
  }

  bool(n: FlowNode, key: string): boolean {
    return n.data?.[key] === true;
  }

  num(n: FlowNode | null, key: string, fallback: number): number {
    const v = n?.data?.[key];
    return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  }

  // --- Preview / variáveis (T-025) ---

  /** Texto com as variáveis conhecidas substituídas pelas amostras. */
  preview(text: string): string {
    return interpolateSamples(text, this.variables());
  }

  /** Variáveis usadas no texto que não constam na lista conhecida. */
  badVars(text: string): string[] {
    return unknownVariables(text, this.variables());
  }

  /** Memoriza o campo interpolável focado (e seu caret) para inserção. */
  rememberField(ev: Event): void {
    const el = ev.target as HTMLTextAreaElement | HTMLInputElement;
    this.focused = el;
  }

  /** Edição em campo interpolável: lembra o caret e emite o patch normal. */
  onInterpInput(key: string, ev: Event): void {
    if (this.ro()) return;
    const el = ev.target as HTMLTextAreaElement | HTMLInputElement;
    this.focused = el;
    this.focusedKey.set(key);
    this.patch.emit({ [key]: el.value });
  }

  /**
   * Insere `{{name}}` na posição do cursor do campo (selectionStart/End);
   * se o campo informado não for o focado, anexa ao fim. Atualiza o valor do
   * elemento e emite o patch com o texto cru resultante.
   */
  insertVar(field: HTMLTextAreaElement | HTMLInputElement, name: string): void {
    if (this.ro()) return;
    const el = field;
    const token = `{{${name}}}`;
    const current = el.value;
    const hasCaret = this.focused === el && el.selectionStart !== null;
    const start = hasCaret ? (el.selectionStart ?? current.length) : current.length;
    const end = hasCaret ? (el.selectionEnd ?? current.length) : current.length;
    const next = current.slice(0, start) + token + current.slice(end);
    el.value = next;
    // Reposiciona o caret após o token inserido.
    const pos = start + token.length;
    el.focus();
    try {
      el.setSelectionRange(pos, pos);
    } catch {
      /* inputs sem suporte a setSelectionRange */
    }
    this.focused = el;
    // Descobre a chave do campo a partir do atributo de placeholder não é confiável;
    // usamos a última chave editada/focada.
    const key = this.focusedKey() || this.inferKey(el);
    this.focusedKey.set(key);
    this.patch.emit({ [key]: next });
  }

  /** Heurística: deduz a chave do campo (fallback quando ainda não houve input). */
  private inferKey(el: HTMLTextAreaElement | HTMLInputElement): string {
    const n = this.node();
    if (!n) return 'text';
    // AI usa 'prompt'; demais campos interpoláveis usam 'text'.
    return n.type === 'AI' ? 'prompt' : 'text';
  }

  patchField(key: string, ev: Event): void {
    if (this.ro()) return;
    const el = ev.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    this.patch.emit({ [key]: el.value });
  }

  patchNumber(key: string, ev: Event): void {
    if (this.ro()) return;
    const raw = (ev.target as HTMLInputElement).value;
    const parsed = Number(raw);
    this.patch.emit({ [key]: Number.isFinite(parsed) ? parsed : 0 });
  }

  patchFromInput(ev: Event): void {
    if (this.ro()) return;
    const checked = (ev.target as HTMLInputElement).checked;
    // Limpa o valor estático ao alternar para "vem da resposta".
    this.patch.emit(checked ? { fromInput: true, value: '' } : { fromInput: false });
  }

  // --- MENU options ---

  private emitOptions(opts: MenuOption[]): void {
    this.patch.emit({ options: opts.map(o => ({ id: o.id, label: o.label })) });
  }

  addOption(): void {
    if (this.ro()) return;
    const opts = this.options();
    this.emitOptions([...opts, { id: uid('opt'), label: `Opção ${opts.length + 1}` }]);
  }

  removeOption(i: number): void {
    if (this.ro()) return;
    this.emitOptions(this.options().filter((_, idx) => idx !== i));
  }

  onOptionLabel(i: number, ev: Event): void {
    if (this.ro()) return;
    const label = (ev.target as HTMLInputElement).value;
    this.emitOptions(this.options().map((o, idx) => (idx === i ? { ...o, label } : o)));
  }

  moveOption(i: number, dir: -1 | 1): void {
    if (this.ro()) return;
    const opts = [...this.options()];
    const j = i + dir;
    if (j < 0 || j >= opts.length) return;
    [opts[i], opts[j]] = [opts[j], opts[i]];
    this.emitOptions(opts);
  }
}
