import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { debounceTime } from 'rxjs';
import { Conversation, ConversationStatus, InboxService } from '../../inbox.service';

const STATUS_OPTIONS: { value: ConversationStatus | ''; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'OPEN', label: 'Abertos' },
  { value: 'PENDING', label: 'Pendentes' },
  { value: 'RESOLVED', label: 'Resolvidos' },
  { value: 'SPAM', label: 'Spam' },
];

const PAGE_SIZE = 20;

@Component({
  selector: 'wf-conversation-list',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="col-head">
      <h2>Conversas</h2>
      <form class="filters" [formGroup]="form">
        <input class="wf-input" formControlName="search" placeholder="Buscar contato..." />
        <select class="wf-input" formControlName="status">
          @for (opt of statusOptions; track opt.value) {
            <option [value]="opt.value">{{ opt.label }}</option>
          }
        </select>
      </form>
    </div>

    <div class="list" (scroll)="onScroll($event)">
      @if (error()) {
        <p class="error">{{ error() }}</p>
      }

      @if (loading() && items().length === 0) {
        <p class="muted">Carregando conversas...</p>
      } @else if (items().length === 0) {
        <p class="muted">Nenhuma conversa encontrada.</p>
      } @else {
        @for (conv of items(); track conv.id) {
          <button
            type="button"
            class="conv"
            [class.active]="conv.id === selectedId"
            (click)="select.emit(conv)"
          >
            <div class="avatar">
              @if (conv.contact.avatarUrl) {
                <img [src]="conv.contact.avatarUrl" alt="" />
              } @else {
                <span>{{ initials(conv) }}</span>
              }
            </div>
            <div class="body">
              <div class="row">
                <strong class="name">{{ conv.contact.name || conv.contact.phone }}</strong>
                <span class="time">{{ shortTime(conv.lastMessageAt) }}</span>
              </div>
              <div class="row">
                <span class="preview">{{ conv.lastMessagePreview || 'Sem mensagens' }}</span>
                @if (conv.unreadCount > 0) {
                  <span class="badge">{{ conv.unreadCount }}</span>
                }
              </div>
            </div>
          </button>
        }
        @if (loadingMore()) {
          <p class="muted center">Carregando mais...</p>
        }
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
      }
      .col-head {
        padding: 1rem;
        border-bottom: 1px solid #e4e9f0;
      }
      h2 {
        font-size: 1.05rem;
        margin-bottom: 0.6rem;
      }
      .filters {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }
      .filters .wf-input {
        width: 100%;
        padding: 0.45rem 0.6rem;
        border: 1px solid #d0d5dd;
        border-radius: 8px;
        font: inherit;
      }
      .list {
        flex: 1;
        overflow-y: auto;
        min-height: 0;
      }
      .conv {
        display: flex;
        gap: 0.6rem;
        width: 100%;
        text-align: left;
        padding: 0.7rem 1rem;
        border: none;
        border-bottom: 1px solid #f0f2f6;
        background: transparent;
        cursor: pointer;
      }
      .conv:hover {
        background: #f7f9fc;
      }
      .conv.active {
        background: #ebf5fb;
      }
      .avatar {
        width: 42px;
        height: 42px;
        flex: 0 0 42px;
        border-radius: 50%;
        background: #cfd8e3;
        color: #334;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        overflow: hidden;
      }
      .avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .body {
        flex: 1;
        min-width: 0;
      }
      .row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.4rem;
      }
      .name {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .time {
        font-size: 0.7rem;
        opacity: 0.6;
        flex: 0 0 auto;
      }
      .preview {
        font-size: 0.8rem;
        opacity: 0.7;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .badge {
        flex: 0 0 auto;
        font-size: 0.7rem;
        min-width: 18px;
        height: 18px;
        padding: 0 0.35rem;
        border-radius: 999px;
        background: #25d366;
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .muted {
        opacity: 0.65;
        padding: 1rem;
      }
      .muted.center {
        text-align: center;
      }
      .error {
        color: #b42318;
        padding: 1rem;
      }
    `,
  ],
})
export class ConversationListComponent implements OnInit {
  private svc = inject(InboxService);
  private fb = inject(FormBuilder);

  @Input() selectedId: string | null = null;
  @Output() select = new EventEmitter<Conversation>();

  statusOptions = STATUS_OPTIONS;

  items = signal<Conversation[]>([]);
  loading = signal(false);
  loadingMore = signal(false);
  error = signal<string | null>(null);

  private page = 1;
  private total = 0;

  form = this.fb.nonNullable.group({
    search: [''],
    status: [''] as [ConversationStatus | ''],
  });

  ngOnInit(): void {
    this.reload();
    this.form.valueChanges.pipe(debounceTime(300)).subscribe(() => this.reload());
  }

  /** Recarrega do zero (mudança de filtro ou primeira carga). */
  reload(): void {
    this.page = 1;
    this.loading.set(true);
    this.error.set(null);
    this.fetch(true);
  }

  /** Scroll infinito: dispara ao chegar perto do fim da lista. */
  onScroll(ev: Event): void {
    const el = ev.target as HTMLElement;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) {
      this.loadMore();
    }
  }

  private loadMore(): void {
    if (this.loading() || this.loadingMore()) return;
    if (this.items().length >= this.total) return;
    this.page += 1;
    this.loadingMore.set(true);
    this.fetch(false);
  }

  private fetch(replace: boolean): void {
    const { search, status } = this.form.getRawValue();
    this.svc.listConversations({ search, status, page: this.page, pageSize: PAGE_SIZE }).subscribe({
      next: res => {
        this.total = res.total;
        this.items.update(cur => (replace ? res.data : [...cur, ...res.data]));
        this.loading.set(false);
        this.loadingMore.set(false);
      },
      error: () => {
        this.error.set('Falha ao carregar conversas');
        this.loading.set(false);
        this.loadingMore.set(false);
      },
    });
  }

  /** Marca uma conversa como lida na lista local (após abrir). */
  clearUnread(id: string): void {
    this.items.update(list => list.map(c => (c.id === id ? { ...c, unreadCount: 0 } : c)));
  }

  initials(conv: Conversation): string {
    const src = conv.contact.name || conv.contact.phone || '?';
    return src.trim().slice(0, 2).toUpperCase();
  }

  shortTime(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    return sameDay
      ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
  }
}
