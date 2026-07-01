import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import {
  Conversation,
  ConversationStatus,
  ConversationTag,
  InboxService,
} from '../../inbox.service';
import { TagAutocompleteComponent } from '@shared/components/tag-autocomplete/tag-autocomplete.component';
import { TagsService, type Tag } from '@shared/services/tags.service';

const STATUS_LABEL: Record<ConversationStatus, string> = {
  OPEN: 'Aberta',
  PENDING: 'Pendente',
  RESOLVED: 'Resolvida',
  SPAM: 'Spam',
};

@Component({
  selector: 'wf-contact-info-panel',
  standalone: true,
  imports: [TagAutocompleteComponent],
  template: `
    @if (!conversation) {
      <p class="muted">Sem conversa selecionada.</p>
    } @else {
      <div class="avatar">
        @if (conversation.contact.avatarUrl) {
          <img [src]="conversation.contact.avatarUrl" alt="" />
        } @else {
          <span>{{ initials() }}</span>
        }
      </div>
      <h2>{{ conversation.contact.name || 'Sem nome' }}</h2>
      <p class="phone">{{ conversation.contact.phone }}</p>

      <dl class="info">
        <dt>Status</dt>
        <dd>
          <span class="badge" [class]="'st-' + conversation.status">
            {{ statusLabel(conversation.status) }}
          </span>
        </dd>
        <dt>Bot</dt>
        <dd>{{ conversation.botActive ? 'Ativo' : 'Desativado' }}</dd>
        <dt>Atribuição</dt>
        <dd>{{ conversation.assignedToUserId ? 'Atribuída' : 'Não atribuída' }}</dd>
        <dt>Última mensagem</dt>
        <dd>{{ lastAt() }}</dd>
      </dl>

      <section class="tags-section">
        <h3>Tags</h3>
        <wf-tag-autocomplete
          [selected]="selectedTags()"
          placeholder="Buscar ou criar tag..."
          (chosen)="onAttach($event)"
          (create)="onCreate($event)"
          (remove)="onDetach($event)"
        />
        @if (tagErr()) {
          <p class="error">{{ tagErr() }}</p>
        }
      </section>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        padding: 1.25rem 1rem;
        text-align: center;
      }
      .avatar {
        width: 80px;
        height: 80px;
        margin: 0 auto 0.8rem;
        border-radius: 50%;
        background: #cfd8e3;
        color: #334;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.6rem;
        font-weight: 600;
        overflow: hidden;
      }
      .avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      h2 {
        font-size: 1.1rem;
      }
      .phone {
        opacity: 0.65;
        font-size: 0.85rem;
        margin-bottom: 1rem;
      }
      .info {
        text-align: left;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.5rem 0.75rem;
        margin-top: 0.5rem;
      }
      dt {
        font-size: 0.75rem;
        text-transform: uppercase;
        opacity: 0.55;
      }
      dd {
        font-size: 0.85rem;
        text-align: right;
      }
      .badge {
        font-size: 0.7rem;
        padding: 0.15rem 0.5rem;
        border-radius: 999px;
        background: #eee;
      }
      .st-OPEN {
        background: #d1fae5;
        color: #065f46;
      }
      .st-PENDING {
        background: #fef3c7;
        color: #92400e;
      }
      .st-RESOLVED {
        background: #e0e7ff;
        color: #3730a3;
      }
      .st-SPAM {
        background: #fee2e2;
        color: #991b1b;
      }
      .muted {
        opacity: 0.65;
      }
      .tags-section {
        text-align: left;
        margin-top: 1.25rem;
        border-top: 1px solid #eef1f5;
        padding-top: 1rem;
      }
      .tags-section h3 {
        font-size: 0.75rem;
        text-transform: uppercase;
        opacity: 0.55;
        margin-bottom: 0.6rem;
      }
      .error {
        color: #b42318;
        font-size: 0.78rem;
        margin-top: 0.4rem;
      }
    `,
  ],
})
export class ContactInfoPanelComponent {
  private inbox = inject(InboxService);
  private tagsSvc = inject(TagsService);

  /** Tags atualmente exibidas no autocomplete (estado local, sincronizado com a conversa). */
  private tags = signal<Tag[]>([]);
  tagErr = signal<string | null>(null);

  private _conversation: Conversation | null = null;

  @Input() set conversation(conv: Conversation | null) {
    this._conversation = conv;
    this.tagErr.set(null);
    this.tags.set((conv?.tags ?? []).map(t => this.toTag(t)));
  }
  get conversation(): Conversation | null {
    return this._conversation;
  }

  /** Emite a lista de tags atualizada para o pai refletir na conversa selecionada. */
  @Output() tagsChanged = new EventEmitter<{ id: string; tags: ConversationTag[] }>();

  selectedTags(): Tag[] {
    return this.tags();
  }

  /** Anexa uma tag existente à conversa. */
  onAttach(tag: Tag): void {
    const conv = this._conversation;
    if (!conv || this.tags().some(t => t.id === tag.id)) return;
    this.inbox.attachTag(conv.id, tag.id).subscribe({
      next: () => this.applyTags(conv.id, [...this.tags(), tag]),
      error: () => this.tagErr.set('Falha ao anexar a tag'),
    });
  }

  /** Cria uma tag nova e anexa à conversa. */
  onCreate(name: string): void {
    const conv = this._conversation;
    if (!conv) return;
    this.tagsSvc.create({ name }).subscribe({
      next: tag => this.onAttach(tag),
      error: () => this.tagErr.set('Falha ao criar a tag'),
    });
  }

  /** Remove a tag da conversa. */
  onDetach(tag: Tag): void {
    const conv = this._conversation;
    if (!conv) return;
    this.inbox.detachTag(conv.id, tag.id).subscribe({
      next: () =>
        this.applyTags(
          conv.id,
          this.tags().filter(t => t.id !== tag.id),
        ),
      error: () => this.tagErr.set('Falha ao remover a tag'),
    });
  }

  private applyTags(conversationId: string, tags: Tag[]): void {
    this.tags.set(tags);
    if (this._conversation?.id === conversationId) {
      this._conversation = { ...this._conversation, tags: tags.map(t => this.toConvTag(t)) };
    }
    this.tagsChanged.emit({ id: conversationId, tags: tags.map(t => this.toConvTag(t)) });
  }

  private toTag(t: ConversationTag): Tag {
    return { id: t.id, name: t.name, color: t.color, createdAt: '' };
  }

  private toConvTag(t: Tag): ConversationTag {
    return { id: t.id, name: t.name, color: t.color };
  }

  statusLabel(s: ConversationStatus): string {
    return STATUS_LABEL[s] ?? s;
  }

  initials(): string {
    const c = this.conversation?.contact;
    const src = c?.name || c?.phone || '?';
    return src.trim().slice(0, 2).toUpperCase();
  }

  lastAt(): string {
    const iso = this.conversation?.lastMessageAt;
    if (!iso) return '—';
    return new Date(iso).toLocaleString();
  }
}
