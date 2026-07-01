import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, startWith, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { TagsService, type Tag } from '@shared/services/tags.service';

/**
 * Autocomplete de tags reutilizável (T-043).
 *
 * - Busca tags via `GET /v1/tags?q=` enquanto o usuário digita (debounce).
 * - Permite selecionar uma tag existente (emite `select`).
 * - Permite criar uma nova tag inline quando o termo não casa com nenhuma
 *   existente (emite `create`).
 *
 * O componente é "controlado": quem usa passa a lista de `selected` e reage aos
 * eventos. Standalone + signals, sem estado de domínio próprio.
 */
@Component({
  selector: 'wf-tag-autocomplete',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="tag-ac">
      @if (selected.length > 0) {
        <div class="selected">
          @for (tag of selected; track tag.id) {
            <span class="chip" [style.background]="tag.color + '22'" [style.color]="tag.color">
              {{ tag.name }}
              <button type="button" class="chip-x" (click)="remove.emit(tag)" aria-label="Remover">
                ×
              </button>
            </span>
          }
        </div>
      }

      <div class="field">
        <input
          class="wf-input"
          [formControl]="query"
          [placeholder]="placeholder"
          (focus)="open.set(true)"
          (keydown.escape)="open.set(false)"
        />
        @if (open()) {
          <ul class="menu">
            @for (tag of suggestions(); track tag.id) {
              <li>
                <button type="button" class="opt" (click)="choose(tag)">
                  <span class="dot" [style.background]="tag.color"></span>
                  {{ tag.name }}
                </button>
              </li>
            } @empty {
              @if (!hasTerm()) {
                <li class="hint">Digite para buscar tags</li>
              }
            }
            @if (canCreate()) {
              <li>
                <button type="button" class="opt create" (click)="createNew()">
                  + Criar tag "{{ term() }}"
                </button>
              </li>
            }
          </ul>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .tag-ac {
        display: grid;
        gap: 0.5rem;
      }
      .selected {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        border-radius: 999px;
        padding: 0.15rem 0.55rem;
        font-size: 0.78rem;
        font-weight: 600;
      }
      .chip-x {
        border: 0;
        background: transparent;
        cursor: pointer;
        font-size: 1rem;
        line-height: 1;
        color: inherit;
        padding: 0;
      }
      .field {
        position: relative;
      }
      .menu {
        position: absolute;
        z-index: 20;
        top: calc(100% + 2px);
        left: 0;
        right: 0;
        margin: 0;
        padding: 0.25rem;
        list-style: none;
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(16, 24, 40, 0.08);
        max-height: 240px;
        overflow-y: auto;
      }
      .opt {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        width: 100%;
        text-align: left;
        border: 0;
        background: transparent;
        cursor: pointer;
        padding: 0.45rem 0.5rem;
        border-radius: 6px;
        font: inherit;
      }
      .opt:hover {
        background: #f3f4f6;
      }
      .opt.create {
        color: #2563eb;
        font-weight: 600;
      }
      .dot {
        width: 0.7rem;
        height: 0.7rem;
        border-radius: 50%;
      }
      .hint {
        padding: 0.45rem 0.5rem;
        color: #98a2b3;
        font-size: 0.82rem;
      }
    `,
  ],
})
export class TagAutocompleteComponent {
  private svc = inject(TagsService);

  /** Tags já selecionadas (controladas pelo pai). */
  @Input() selected: Tag[] = [];
  @Input() placeholder = 'Buscar ou criar tag...';
  /** Permitir criação inline de novas tags. */
  @Input() allowCreate = true;

  /** Emite quando o usuário escolhe uma tag existente. */
  @Output() chosen = new EventEmitter<Tag>();
  /** Emite o nome de uma nova tag a criar. */
  @Output() create = new EventEmitter<string>();
  /** Emite quando o usuário remove uma tag selecionada. */
  @Output() remove = new EventEmitter<Tag>();

  open = signal(false);
  query = new FormControl('', { nonNullable: true });

  /** Resultados da busca remota, reativos ao texto digitado. */
  private results = toSignal(
    this.query.valueChanges.pipe(
      startWith(''),
      debounceTime(200),
      distinctUntilChanged(),
      switchMap(q => (q.trim() ? this.svc.list(q.trim()) : of<Tag[]>([]))),
    ),
    { initialValue: [] as Tag[] },
  );

  term = computed(() => this.query.value.trim());
  hasTerm = computed(() => this.term().length > 0);

  /** Sugestões = resultados menos os já selecionados. */
  suggestions = computed(() => {
    const ids = new Set(this.selected.map(t => t.id));
    return this.results().filter(t => !ids.has(t.id));
  });

  /** Pode criar se o termo não casa exatamente com nenhuma tag existente. */
  canCreate = computed(() => {
    if (!this.allowCreate || !this.hasTerm()) return false;
    const lower = this.term().toLowerCase();
    const exists = [...this.results(), ...this.selected].some(t => t.name.toLowerCase() === lower);
    return !exists;
  });

  choose(tag: Tag): void {
    this.chosen.emit(tag);
    this.reset();
  }

  createNew(): void {
    const name = this.term();
    if (!name) return;
    this.create.emit(name);
    this.reset();
  }

  private reset(): void {
    this.query.setValue('');
    this.open.set(false);
  }
}
