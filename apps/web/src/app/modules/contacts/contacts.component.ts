import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ContactsService,
  type Contact,
  type ContactImportResult,
  type ContactConversation,
} from './contacts.service';
import { forkJoin, of, type Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TagAutocompleteComponent } from '@shared/components/tag-autocomplete/tag-autocomplete.component';
import { TagsService, type Tag } from '@shared/services/tags.service';

interface CsvPreview {
  headers: string[];
  rows: string[][];
  invalid: number;
}

@Component({
  selector: 'wf-contacts',
  standalone: true,
  imports: [ReactiveFormsModule, TagAutocompleteComponent],
  template: `
    <section class="page">
      <header class="page-head">
        <div>
          <h1>Contatos</h1>
          <p class="muted">{{ total() }} contato(s)</p>
        </div>
        <div class="head-actions">
          <button type="button" class="wf-btn" (click)="downloadCsv()">Exportar CSV</button>
          <button type="button" class="wf-btn wf-btn--primary" (click)="openNew()">
            Novo contato
          </button>
        </div>
      </header>

      @if (error()) {
        <p class="error">{{ error() }}</p>
      }

      <div class="toolbar">
        <form class="search" (ngSubmit)="search()">
          <input
            class="wf-input"
            [formControl]="searchCtrl"
            placeholder="Buscar por nome, telefone ou e-mail"
          />
          <button type="submit" class="wf-btn">Buscar</button>
        </form>
        <div class="filter">
          <label class="muted" for="tagFilter">Filtrar por tag</label>
          <select
            id="tagFilter"
            class="wf-input"
            [value]="tagFilter() ?? ''"
            (change)="onTagFilter($event)"
          >
            <option value="">Todas</option>
            @for (tag of allTags(); track tag.id) {
              <option [value]="tag.id">{{ tag.name }}</option>
            }
          </select>
        </div>
        <div class="pager">
          <button type="button" class="wf-btn" (click)="prevPage()" [disabled]="page() <= 1">
            Anterior
          </button>
          <span>{{ page() }} / {{ totalPages() }}</span>
          <button
            type="button"
            class="wf-btn"
            (click)="nextPage()"
            [disabled]="page() >= totalPages()"
          >
            Próxima
          </button>
        </div>
      </div>

      <section class="workspace">
        <form class="editor" [formGroup]="form" (ngSubmit)="save()">
          <div class="editor-head">
            <strong>{{ editing() ? 'Editar contato' : 'Novo contato' }}</strong>
            @if (editing()) {
              <button type="button" class="link-btn" (click)="cancelEdit()">Cancelar</button>
            }
          </div>
          <label>
            <span>Telefone</span>
            <input class="wf-input" formControlName="phone" placeholder="5527999887766" />
          </label>
          <label>
            <span>Nome</span>
            <input class="wf-input" formControlName="name" placeholder="Nome" />
          </label>
          <label>
            <span>E-mail</span>
            <input class="wf-input" formControlName="email" placeholder="email@dominio.com" />
          </label>
          <div class="checks">
            <label>
              <input type="checkbox" formControlName="isBlocked" />
              Bloqueado
            </label>
            <label>
              <input type="checkbox" formControlName="isOptedOut" />
              Opt-out
            </label>
          </div>
          @if (editing()) {
            <div class="tags-field">
              <span>Tags</span>
              <wf-tag-autocomplete
                [selected]="editingTags()"
                (select)="attachTag($event)"
                (create)="createAndAttach($event)"
                (remove)="detachTag($event)"
              />
            </div>
          }
          <button
            class="wf-btn wf-btn--primary"
            type="submit"
            [disabled]="form.invalid || saving()"
          >
            {{ saving() ? 'Salvando...' : 'Salvar' }}
          </button>

          @if (editing()) {
            <div class="history">
              <span>Histórico de conversas</span>
              @if (historyLoading()) {
                <p class="muted">Carregando histórico...</p>
              } @else if (history().length === 0) {
                <p class="muted">Nenhuma conversa para este contato.</p>
              } @else {
                <ul class="history-list">
                  @for (conv of history(); track conv.id) {
                    <li>
                      <span class="badge">{{ conv.status }}</span>
                      <span class="history-preview">{{
                        conv.lastMessagePreview || 'Sem mensagens'
                      }}</span>
                      <span class="muted history-date">{{
                        conv.lastMessageAt ? formatDate(conv.lastMessageAt) : '-'
                      }}</span>
                      @if (conv.unreadCount > 0) {
                        <span class="unread">{{ conv.unreadCount }}</span>
                      }
                    </li>
                  }
                </ul>
              }
            </div>
          }
        </form>

        <div class="importer">
          <div class="editor-head">
            <strong>Importar CSV</strong>
            <span class="muted">phone, name, email</span>
          </div>
          <input class="file" type="file" accept=".csv,text/csv" (change)="onFile($event)" />
          @if (csvPreview()) {
            <div class="preview">
              <div class="preview-meta">
                <span>{{ csvPreview()?.rows?.length ?? 0 }} linha(s) no preview</span>
                <span>{{ csvPreview()?.invalid ?? 0 }} inválida(s)</span>
              </div>
              <table>
                <thead>
                  <tr>
                    @for (h of csvPreview()?.headers ?? []; track h) {
                      <th>{{ h }}</th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (row of csvPreview()?.rows ?? []; track $index) {
                    <tr>
                      @for (cell of row; track $index) {
                        <td>{{ cell }}</td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
              <button
                type="button"
                class="wf-btn wf-btn--primary"
                (click)="importCsv()"
                [disabled]="importing()"
              >
                {{ importing() ? 'Importando...' : 'Importar' }}
              </button>
            </div>
          }
          @if (importResult()) {
            <div class="result">
              <strong>{{ importResult()?.imported }} importado(s)</strong>
              <span
                >{{ importResult()?.created }} novo(s), {{ importResult()?.updated }} atualizado(s),
                {{ importResult()?.failed }} falha(s)</span
              >
              @if ((importResult()?.errors?.length ?? 0) > 0) {
                <ul>
                  @for (err of importResult()?.errors ?? []; track err.line) {
                    <li>Linha {{ err.line }}: {{ err.message }}</li>
                  }
                </ul>
              }
            </div>
          }
        </div>
      </section>

      @if (selectedCount() > 0) {
        <div class="bulk-bar">
          <strong>{{ selectedCount() }} selecionado(s)</strong>
          <div class="bulk-tag">
            <label class="muted" for="bulkTag">Tag</label>
            <select
              id="bulkTag"
              class="wf-input"
              [value]="bulkTagId() ?? ''"
              (change)="onBulkTag($event)"
            >
              <option value="">Escolha uma tag</option>
              @for (tag of allTags(); track tag.id) {
                <option [value]="tag.id">{{ tag.name }}</option>
              }
            </select>
            <button
              type="button"
              class="wf-btn"
              [disabled]="!bulkTagId() || bulkBusy()"
              (click)="bulkApplyTag()"
            >
              Aplicar tag
            </button>
            <button
              type="button"
              class="wf-btn"
              [disabled]="!bulkTagId() || bulkBusy()"
              (click)="bulkRemoveTag()"
            >
              Remover tag
            </button>
          </div>
          <button
            type="button"
            class="wf-btn wf-btn--danger"
            [disabled]="bulkBusy()"
            (click)="bulkDelete()"
          >
            Excluir selecionados
          </button>
          <button type="button" class="link-btn" (click)="clearSelection()">Limpar seleção</button>
          @if (bulkBusy()) {
            <span class="muted">{{ bulkProgress() }}</span>
          }
        </div>
      }

      <section class="list">
        @if (loading()) {
          <p class="muted">Carregando...</p>
        } @else if (contacts().length === 0) {
          <p class="muted">Nenhum contato encontrado.</p>
        } @else {
          <table>
            <thead>
              <tr>
                <th class="check-col">
                  <input
                    type="checkbox"
                    [checked]="allPageSelected()"
                    [indeterminate]="somePageSelected()"
                    (change)="toggleSelectPage($event)"
                  />
                </th>
                <th>Nome</th>
                <th>Telefone</th>
                <th>E-mail</th>
                <th>Tags</th>
                <th>Status</th>
                <th>Atualizado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (contact of contacts(); track contact.id) {
                <tr [class.active]="editing()?.id === contact.id">
                  <td class="check-col">
                    <input
                      type="checkbox"
                      [checked]="isSelected(contact.id)"
                      (change)="toggleSelect(contact.id, $event)"
                    />
                  </td>
                  <td>{{ contact.name || 'Sem nome' }}</td>
                  <td>{{ contact.phone }}</td>
                  <td>{{ contact.email || '-' }}</td>
                  <td>
                    @for (tag of contact.tags; track tag.id) {
                      <span
                        class="tag-chip"
                        [style.background]="tag.color + '22'"
                        [style.color]="tag.color"
                        >{{ tag.name }}</span
                      >
                    } @empty {
                      <span class="muted">-</span>
                    }
                  </td>
                  <td>
                    <span
                      class="badge"
                      [class.warn]="contact.isOptedOut"
                      [class.danger]="contact.isBlocked"
                    >
                      {{ status(contact) }}
                    </span>
                  </td>
                  <td>{{ formatDate(contact.updatedAt) }}</td>
                  <td class="row-actions">
                    <button type="button" class="wf-btn" (click)="edit(contact)">Editar</button>
                    <button type="button" class="wf-btn wf-btn--danger" (click)="remove(contact)">
                      Excluir
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </section>
    </section>
  `,
  styles: [
    `
      .page {
        padding: 1.5rem 2rem;
      }
      .page-head,
      .toolbar,
      .head-actions,
      .search,
      .pager,
      .editor-head,
      .checks,
      .preview-meta,
      .row-actions {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      .page-head {
        justify-content: space-between;
        margin-bottom: 1rem;
      }
      h1 {
        font-size: 1.5rem;
      }
      .muted {
        opacity: 0.7;
      }
      .toolbar {
        justify-content: space-between;
        margin-bottom: 1rem;
        flex-wrap: wrap;
      }
      .search {
        min-width: min(420px, 100%);
      }
      .filter {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .filter select {
        min-width: 160px;
      }
      .tags-field {
        display: grid;
        gap: 0.35rem;
        font-size: 0.85rem;
        font-weight: 600;
      }
      .tag-chip {
        display: inline-flex;
        border-radius: 999px;
        padding: 0.12rem 0.5rem;
        font-size: 0.72rem;
        font-weight: 600;
        margin: 0 0.2rem 0.2rem 0;
      }
      .workspace {
        display: grid;
        grid-template-columns: minmax(260px, 340px) minmax(320px, 1fr);
        gap: 1rem;
        align-items: start;
        margin-bottom: 1rem;
      }
      .editor,
      .importer,
      .list {
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 1rem;
      }
      .editor {
        display: grid;
        gap: 0.75rem;
      }
      .editor label {
        display: grid;
        gap: 0.35rem;
        font-size: 0.85rem;
        font-weight: 600;
      }
      .checks {
        flex-wrap: wrap;
      }
      .checks label {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        font-weight: 500;
      }
      .editor-head {
        justify-content: space-between;
      }
      .link-btn {
        border: 0;
        background: transparent;
        color: #2563eb;
        cursor: pointer;
        font: inherit;
      }
      .file {
        width: 100%;
        margin: 0.75rem 0;
      }
      .preview {
        display: grid;
        gap: 0.75rem;
      }
      .preview-meta {
        justify-content: space-between;
        color: #475467;
        font-size: 0.85rem;
      }
      .result {
        display: grid;
        gap: 0.35rem;
        margin-top: 0.75rem;
        color: #065f46;
      }
      .result ul {
        color: #b42318;
        padding-left: 1rem;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th,
      td {
        text-align: left;
        border-bottom: 1px solid #eef2f7;
        padding: 0.75rem 0.5rem;
        vertical-align: middle;
      }
      th {
        color: #667085;
        font-size: 0.78rem;
        text-transform: uppercase;
      }
      tr.active {
        background: #eff6ff;
      }
      .badge {
        display: inline-flex;
        border-radius: 999px;
        padding: 0.18rem 0.55rem;
        font-size: 0.75rem;
        background: #d1fae5;
        color: #065f46;
      }
      .badge.warn {
        background: #fef3c7;
        color: #92400e;
      }
      .badge.danger {
        background: #fee2e2;
        color: #991b1b;
      }
      .error {
        color: #b42318;
        margin-bottom: 0.75rem;
      }
      .history {
        display: grid;
        gap: 0.4rem;
        font-size: 0.85rem;
        font-weight: 600;
        border-top: 1px solid #eef2f7;
        padding-top: 0.75rem;
      }
      .history-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: 0.4rem;
        font-weight: 400;
      }
      .history-list li {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.8rem;
      }
      .history-preview {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .history-date {
        font-size: 0.72rem;
      }
      .unread {
        background: #2563eb;
        color: #fff;
        border-radius: 999px;
        padding: 0 0.4rem;
        font-size: 0.7rem;
      }
      .bulk-bar {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        border-radius: 8px;
        padding: 0.75rem 1rem;
        margin-bottom: 1rem;
      }
      .bulk-tag {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .check-col {
        width: 1.5rem;
      }
      @media (max-width: 900px) {
        .workspace {
          grid-template-columns: 1fr;
        }
        .page-head,
        .toolbar {
          align-items: stretch;
          flex-direction: column;
        }
        .head-actions,
        .search,
        .pager {
          width: 100%;
          justify-content: space-between;
        }
        .list {
          overflow-x: auto;
        }
      }
    `,
  ],
})
export class ContactsComponent implements OnInit {
  private svc = inject(ContactsService);
  private tagsSvc = inject(TagsService);
  private fb = inject(FormBuilder);

  contacts = signal<Contact[]>([]);
  total = signal(0);
  page = signal(1);
  pageSize = 25;
  loading = signal(true);
  saving = signal(false);
  importing = signal(false);
  error = signal<string | null>(null);
  editing = signal<Contact | null>(null);
  allTags = signal<Tag[]>([]);
  tagFilter = signal<string | null>(null);
  /** Tags do contato em edição (espelha editing()?.tags). */
  editingTags = computed<Tag[]>(() =>
    (this.editing()?.tags ?? []).map(t => ({
      id: t.id,
      name: t.name,
      color: t.color,
      createdAt: '',
    })),
  );
  csvContent = signal<string | null>(null);
  csvPreview = signal<CsvPreview | null>(null);
  importResult = signal<ContactImportResult | null>(null);
  totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));

  // Histórico de conversas do contato em edição (T-042).
  history = signal<ContactConversation[]>([]);
  historyLoading = signal(false);

  // Seleção múltipla + bulk actions (T-042). Persiste IDs entre páginas.
  selectedIds = signal<Set<string>>(new Set());
  bulkTagId = signal<string | null>(null);
  bulkBusy = signal(false);
  bulkProgress = signal('');
  selectedCount = computed(() => this.selectedIds().size);
  allPageSelected = computed(() => {
    const ids = this.selectedIds();
    const rows = this.contacts();
    return rows.length > 0 && rows.every(c => ids.has(c.id));
  });
  somePageSelected = computed(() => {
    const ids = this.selectedIds();
    const rows = this.contacts();
    const n = rows.filter(c => ids.has(c.id)).length;
    return n > 0 && n < rows.length;
  });

  searchCtrl = this.fb.nonNullable.control('');
  form = this.fb.nonNullable.group({
    phone: ['', [Validators.required, Validators.minLength(8)]],
    name: [''],
    email: ['', [Validators.email]],
    isBlocked: [false],
    isOptedOut: [false],
  });

  ngOnInit(): void {
    this.loadTags();
    this.load();
  }

  loadTags(): void {
    this.tagsSvc.list().subscribe({
      next: tags => this.allTags.set(tags),
      error: () => this.allTags.set([]),
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc
      .list({
        search: this.searchCtrl.value.trim(),
        tagId: this.tagFilter() ?? undefined,
        page: this.page(),
        pageSize: this.pageSize,
      })
      .subscribe({
        next: res => {
          this.contacts.set(res.data);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: (e: { error?: { message?: string } }) => {
          this.error.set(e?.error?.message ?? 'Falha ao carregar contatos');
          this.loading.set(false);
        },
      });
  }

  search(): void {
    this.page.set(1);
    this.load();
  }

  onTagFilter(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.tagFilter.set(value || null);
    this.page.set(1);
    this.load();
  }

  /** Anexa uma tag existente ao contato em edição e recarrega a linha. */
  attachTag(tag: Tag): void {
    const contact = this.editing();
    if (!contact) return;
    this.tagsSvc.attachToContact(contact.id, tag.id).subscribe({
      next: () => this.refreshEditing(contact.id),
      error: (e: { error?: { message?: string } }) =>
        this.error.set(e?.error?.message ?? 'Falha ao aplicar tag'),
    });
  }

  /** Remove a tag do contato em edição. */
  detachTag(tag: Tag): void {
    const contact = this.editing();
    if (!contact) return;
    this.tagsSvc.detachFromContact(contact.id, tag.id).subscribe({
      next: () => this.refreshEditing(contact.id),
      error: (e: { error?: { message?: string } }) =>
        this.error.set(e?.error?.message ?? 'Falha ao remover tag'),
    });
  }

  /** Cria uma tag inline e já a anexa ao contato em edição. */
  createAndAttach(name: string): void {
    const contact = this.editing();
    if (!contact) return;
    this.tagsSvc.create({ name }).subscribe({
      next: tag => {
        this.allTags.update(tags => [...tags, tag].sort((a, b) => a.name.localeCompare(b.name)));
        this.attachTag(tag);
      },
      error: (e: { error?: { message?: string } }) =>
        this.error.set(e?.error?.message ?? 'Falha ao criar tag'),
    });
  }

  /** Recarrega a lista e re-seleciona o contato editado (tags atualizadas). */
  private refreshEditing(contactId: string): void {
    this.svc
      .list({
        search: this.searchCtrl.value.trim(),
        tagId: this.tagFilter() ?? undefined,
        page: this.page(),
        pageSize: this.pageSize,
      })
      .subscribe({
        next: res => {
          this.contacts.set(res.data);
          this.total.set(res.total);
          const refreshed = res.data.find(c => c.id === contactId);
          if (refreshed) this.editing.set(refreshed);
        },
      });
  }

  prevPage(): void {
    if (this.page() <= 1) return;
    this.page.update(v => v - 1);
    this.load();
  }

  nextPage(): void {
    if (this.page() >= this.totalPages()) return;
    this.page.update(v => v + 1);
    this.load();
  }

  openNew(): void {
    this.editing.set(null);
    this.history.set([]);
    this.form.reset({ phone: '', name: '', email: '', isBlocked: false, isOptedOut: false });
  }

  edit(contact: Contact): void {
    this.editing.set(contact);
    this.form.reset({
      phone: contact.phone,
      name: contact.name ?? '',
      email: contact.email ?? '',
      isBlocked: contact.isBlocked,
      isOptedOut: contact.isOptedOut,
    });
    this.loadHistory(contact.id);
  }

  /** Carrega o histórico de conversas do contato (T-042 — reusa ?contactId=). */
  private loadHistory(contactId: string): void {
    this.history.set([]);
    this.historyLoading.set(true);
    this.svc.conversations(contactId).subscribe({
      next: res => {
        this.history.set(res.data);
        this.historyLoading.set(false);
      },
      error: () => {
        this.history.set([]);
        this.historyLoading.set(false);
      },
    });
  }

  cancelEdit(): void {
    this.openNew();
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.error.set(null);
    const current = this.editing();
    const raw = this.form.getRawValue();
    const payload = {
      phone: raw.phone,
      name: raw.name.trim() || (current ? null : undefined),
      email: raw.email.trim() || (current ? null : undefined),
      customFields: {},
      isBlocked: raw.isBlocked,
      isOptedOut: raw.isOptedOut,
      tagIds: current?.tags.map(t => t.id) ?? [],
    };
    const req = current ? this.svc.update(current.id, payload) : this.svc.create(payload);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.openNew();
        this.load();
      },
      error: (e: { error?: { message?: string } }) => {
        this.error.set(e?.error?.message ?? 'Falha ao salvar contato');
        this.saving.set(false);
      },
    });
  }

  remove(contact: Contact): void {
    if (!confirm(`Excluir "${contact.name || contact.phone}"?`)) return;
    this.svc.remove(contact.id).subscribe({
      next: () => this.load(),
      error: (e: { error?: { message?: string } }) =>
        this.error.set(e?.error?.message ?? 'Falha ao excluir contato'),
    });
  }

  // ---- Seleção múltipla + bulk actions (T-042) ----

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  toggleSelect(id: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedIds.update(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  toggleSelectPage(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const pageIds = this.contacts().map(c => c.id);
    this.selectedIds.update(prev => {
      const next = new Set(prev);
      if (checked) pageIds.forEach(id => next.add(id));
      else pageIds.forEach(id => next.delete(id));
      return next;
    });
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
    this.bulkTagId.set(null);
    this.bulkProgress.set('');
  }

  onBulkTag(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.bulkTagId.set(value || null);
  }

  bulkApplyTag(): void {
    const tagId = this.bulkTagId();
    if (!tagId) return;
    this.runBulk(id => this.tagsSvc.attachToContact(id, tagId), 'Aplicando tag');
  }

  bulkRemoveTag(): void {
    const tagId = this.bulkTagId();
    if (!tagId) return;
    this.runBulk(id => this.tagsSvc.detachFromContact(id, tagId), 'Removendo tag');
  }

  bulkDelete(): void {
    const ids = [...this.selectedIds()];
    if (ids.length === 0) return;
    if (!confirm(`Excluir ${ids.length} contato(s) selecionado(s)?`)) return;
    this.runBulk(id => this.svc.remove(id), 'Excluindo');
  }

  /**
   * Executa uma ação por contato selecionado em lotes (concorrência limitada),
   * para não disparar ~100 requests simultâneos nem travar a UI.
   */
  private runBulk(op: (id: string) => Observable<unknown>, label: string): void {
    const ids = [...this.selectedIds()];
    if (ids.length === 0 || this.bulkBusy()) return;
    this.bulkBusy.set(true);
    this.error.set(null);
    const batchSize = 10;
    let done = 0;
    let failed = 0;

    const runBatch = (start: number): void => {
      const slice = ids.slice(start, start + batchSize);
      if (slice.length === 0) {
        this.bulkBusy.set(false);
        this.bulkProgress.set('');
        this.clearSelection();
        if (failed > 0) this.error.set(`${failed} item(ns) falharam na ação em lote`);
        this.load();
        return;
      }
      this.bulkProgress.set(`${label}: ${done}/${ids.length}`);
      forkJoin(
        slice.map(id =>
          op(id).pipe(
            catchError(() => {
              failed += 1;
              return of(null);
            }),
          ),
        ),
      ).subscribe(() => {
        done += slice.length;
        runBatch(start + batchSize);
      });
    };

    runBatch(0);
  }

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const csv = String(reader.result ?? '');
      this.csvContent.set(csv);
      this.importResult.set(null);
      this.csvPreview.set(this.preview(csv));
    };
    reader.readAsText(file);
  }

  importCsv(): void {
    const csv = this.csvContent();
    if (!csv) return;
    this.importing.set(true);
    this.svc.importCsv(csv).subscribe({
      next: result => {
        this.importResult.set(result);
        this.importing.set(false);
        this.load();
      },
      error: (e: { error?: { message?: string } }) => {
        this.error.set(e?.error?.message ?? 'Falha ao importar CSV');
        this.importing.set(false);
      },
    });
  }

  downloadCsv(): void {
    this.svc.exportCsv(this.searchCtrl.value.trim()).subscribe({
      next: csv => {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'contacts.csv';
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.error.set('Falha ao exportar contatos'),
    });
  }

  status(contact: Contact): string {
    if (contact.isBlocked) return 'Bloqueado';
    if (contact.isOptedOut) return 'Opt-out';
    return 'Ativo';
  }

  formatDate(value: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  private preview(csv: string): CsvPreview {
    const lines = csv.split(/\r?\n/).filter(line => line.trim());
    const delimiter =
      (lines[0]?.match(/;/g) ?? []).length > (lines[0]?.match(/,/g) ?? []).length ? ';' : ',';
    const headers = (lines[0] ?? '').split(delimiter).map(v => v.trim());
    const phoneIndex = headers.findIndex(h =>
      ['phone', 'telefone', 'numero', 'número', 'whatsapp'].includes(h.toLowerCase()),
    );
    let invalid = 0;
    const rows = lines.slice(1, 6).map(line => {
      const cols = line.split(delimiter).map(v => v.trim());
      const phone = (cols[phoneIndex] ?? '').replace(/\D/g, '');
      if (phoneIndex === -1 || !/^[1-9]\d{7,14}$/.test(phone)) invalid += 1;
      return cols;
    });
    return { headers, rows, invalid };
  }
}
