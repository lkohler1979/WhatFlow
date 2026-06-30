import {
  AfterViewChecked,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Conversation, InboxService, Message } from '../../inbox.service';

const PAGE_SIZE = 30;

@Component({
  selector: 'wf-chat-window',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    @if (!conversation) {
      <div class="empty">
        <p class="muted">Selecione uma conversa para começar.</p>
      </div>
    } @else {
      <header class="chat-head">
        <div class="who">
          <strong>{{ conversation.contact.name || conversation.contact.phone }}</strong>
          <span class="phone">{{ conversation.contact.phone }}</span>
        </div>
        <button
          type="button"
          class="bot-toggle"
          [class.on]="conversation.botActive"
          [disabled]="togglingBot()"
          (click)="toggleBot()"
          [title]="
            conversation.botActive ? 'Bot respondendo — clique para assumir' : 'Você está atendendo'
          "
        >
          {{ conversation.botActive ? '🤖 Bot ativo' : '🙋 Atendimento humano' }}
        </button>
      </header>

      <div #scroller class="messages" (scroll)="onScroll($event)">
        @if (loadingMore()) {
          <p class="muted center">Carregando histórico...</p>
        }
        @if (loading() && messages().length === 0) {
          <p class="muted center">Carregando mensagens...</p>
        } @else if (messages().length === 0) {
          <p class="muted center">Nenhuma mensagem ainda.</p>
        } @else {
          @for (msg of messages(); track msg.id) {
            @if (msg.isInternal) {
              <div class="note-row">
                <div class="note">
                  <span class="note-label">🗒️ Nota interna · não enviada ao cliente</span>
                  <span class="text">{{ msg.content }}</span>
                  <span class="meta">{{ time(msg.timestamp) }}</span>
                </div>
              </div>
            } @else {
              <div class="bubble-row" [class.out]="msg.direction === 'OUTBOUND'">
                <div class="bubble" [class.out]="msg.direction === 'OUTBOUND'">
                  <span class="text">{{ msg.content }}</span>
                  <span class="meta">{{ time(msg.timestamp) }}</span>
                </div>
              </div>
            }
          }
        }
      </div>

      <div class="composer-mode">
        <button
          type="button"
          class="mode-tab"
          [class.active]="!noteMode()"
          (click)="setNoteMode(false)"
        >
          Mensagem
        </button>
        <button
          type="button"
          class="mode-tab note"
          [class.active]="noteMode()"
          (click)="setNoteMode(true)"
        >
          🗒️ Nota interna
        </button>
      </div>

      <form class="composer" [class.note]="noteMode()" [formGroup]="form" (ngSubmit)="send()">
        <input
          class="wf-input"
          formControlName="text"
          [placeholder]="
            noteMode() ? 'Nota interna (não vai ao cliente)...' : 'Digite uma mensagem...'
          "
        />
        <button class="wf-btn wf-btn--primary" type="submit" [disabled]="form.invalid || sending()">
          {{ sending() ? '...' : noteMode() ? 'Salvar nota' : 'Enviar' }}
        </button>
      </form>
      @if (sendErr()) {
        <p class="error">{{ sendErr() }}</p>
      }
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        background: #f5f7fb;
      }
      .empty {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .chat-head {
        padding: 0.8rem 1rem;
        background: #fff;
        border-bottom: 1px solid #e4e9f0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
      }
      .chat-head .who {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .chat-head .phone {
        font-size: 0.75rem;
        opacity: 0.6;
      }
      .bot-toggle {
        flex: 0 0 auto;
        border: 1px solid #d0d5dd;
        background: #fff7e6;
        color: #92400e;
        padding: 0.35rem 0.7rem;
        border-radius: 999px;
        font-size: 0.78rem;
        cursor: pointer;
      }
      .bot-toggle.on {
        background: #e7f8ee;
        color: #065f46;
        border-color: #b7e4c7;
      }
      .bot-toggle:disabled {
        opacity: 0.6;
        cursor: default;
      }
      .messages {
        flex: 1;
        overflow-y: auto;
        min-height: 0;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }
      .bubble-row {
        display: flex;
        justify-content: flex-start;
      }
      .bubble-row.out {
        justify-content: flex-end;
      }
      .bubble {
        max-width: 70%;
        padding: 0.5rem 0.7rem;
        border-radius: 10px;
        background: #fff;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
        display: flex;
        flex-direction: column;
      }
      .bubble.out {
        background: #d9fdd3;
      }
      .note-row {
        display: flex;
        justify-content: center;
      }
      .note {
        max-width: 80%;
        padding: 0.5rem 0.7rem;
        border-radius: 10px;
        background: #fff8d6;
        border: 1px solid #f4e08a;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
        display: flex;
        flex-direction: column;
        color: #6b5b16;
      }
      .note-label {
        font-size: 0.68rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.02em;
        opacity: 0.8;
        margin-bottom: 0.2rem;
      }
      .text {
        white-space: pre-wrap;
        word-break: break-word;
      }
      .meta {
        align-self: flex-end;
        font-size: 0.65rem;
        opacity: 0.5;
        margin-top: 0.15rem;
      }
      .composer-mode {
        display: flex;
        gap: 0.25rem;
        padding: 0.5rem 1rem 0;
        background: #fff;
      }
      .mode-tab {
        border: 1px solid #d0d5dd;
        background: #f7f9fc;
        color: #475467;
        padding: 0.25rem 0.7rem;
        border-radius: 999px;
        font-size: 0.75rem;
        cursor: pointer;
      }
      .mode-tab.active {
        background: #ebf5fb;
        border-color: #93c5fd;
        color: #1d4ed8;
        font-weight: 600;
      }
      .mode-tab.note.active {
        background: #fff8d6;
        border-color: #f4e08a;
        color: #6b5b16;
      }
      .composer {
        display: flex;
        gap: 0.5rem;
        padding: 0.7rem 1rem;
        background: #fff;
        border-top: 1px solid #e4e9f0;
      }
      .composer.note {
        background: #fffdf2;
      }
      .composer.note .wf-input {
        border-color: #f4e08a;
        background: #fffdf2;
      }
      .composer .wf-input {
        flex: 1;
        padding: 0.55rem 0.7rem;
        border: 1px solid #d0d5dd;
        border-radius: 8px;
        font: inherit;
      }
      .muted {
        opacity: 0.65;
      }
      .muted.center {
        text-align: center;
      }
      .error {
        color: #b42318;
        padding: 0 1rem 0.6rem;
        font-size: 0.8rem;
      }
    `,
  ],
})
export class ChatWindowComponent implements AfterViewChecked {
  private svc = inject(InboxService);
  private fb = inject(FormBuilder);

  @ViewChild('scroller') private scroller?: ElementRef<HTMLElement>;
  /** Emite quando a conversa aberta foi marcada como lida (para zerar badge na lista). */
  @Output() read = new EventEmitter<string>();
  /** Emite ao alternar o bot (para o Inbox refletir na lista/selecionada). */
  @Output() botToggled = new EventEmitter<{ id: string; botActive: boolean }>();

  messages = signal<Message[]>([]);
  loading = signal(false);
  loadingMore = signal(false);
  sending = signal(false);
  sendErr = signal<string | null>(null);
  togglingBot = signal(false);
  /** Quando true, o composer registra uma NOTA INTERNA (não vai ao WhatsApp). */
  noteMode = signal(false);

  conversation: Conversation | null = null;
  private nextCursor: string | null = null;
  private shouldScrollBottom = false;
  private preserveFromTop = false;
  private lastScrollHeight = 0;

  form = this.fb.nonNullable.group({
    text: ['', [Validators.required, Validators.minLength(1)]],
  });

  /** Chamado pelo InboxComponent quando muda a conversa selecionada. */
  @Input() set selected(conv: Conversation | null) {
    this.conversation = conv;
    this.messages.set([]);
    this.nextCursor = null;
    this.sendErr.set(null);
    this.noteMode.set(false);
    this.form.reset({ text: '' });
    if (conv) {
      this.loadInitial(conv.id);
      this.svc.markRead(conv.id).subscribe({
        next: () => this.read.emit(conv.id),
        error: () => {},
      });
    }
  }

  /**
   * Acrescenta uma mensagem recebida em tempo real, se for da conversa aberta
   * e ainda não estiver na lista (dedupe por id — o envio do agente já fez push local).
   */
  appendIncoming(conversationId: string, msg: Message): void {
    if (!this.conversation || this.conversation.id !== conversationId) return;
    if (this.messages().some(m => m.id === msg.id)) return;
    this.messages.update(cur => [...cur, msg]);
    this.shouldScrollBottom = true;
  }

  /** Id da conversa atualmente aberta (para o orquestrador decidir append vs badge). */
  get currentId(): string | null {
    return this.conversation?.id ?? null;
  }

  ngAfterViewChecked(): void {
    const el = this.scroller?.nativeElement;
    if (!el) return;
    if (this.shouldScrollBottom) {
      el.scrollTop = el.scrollHeight;
      this.shouldScrollBottom = false;
    } else if (this.preserveFromTop) {
      // Após prepend de histórico, mantém a posição visual do usuário.
      el.scrollTop = el.scrollHeight - this.lastScrollHeight;
      this.preserveFromTop = false;
    }
  }

  private loadInitial(id: string): void {
    this.loading.set(true);
    this.svc.listMessages(id, null, PAGE_SIZE).subscribe({
      next: res => {
        this.messages.set(res.data);
        this.nextCursor = res.nextCursor;
        this.loading.set(false);
        this.shouldScrollBottom = true;
      },
      error: () => this.loading.set(false),
    });
  }

  /** Scroll infinito do histórico: ao rolar para o topo, carrega mais antigas. */
  onScroll(ev: Event): void {
    const el = ev.target as HTMLElement;
    if (el.scrollTop <= 40) this.loadOlder();
  }

  private loadOlder(): void {
    if (!this.conversation || !this.nextCursor) return;
    if (this.loading() || this.loadingMore()) return;
    this.loadingMore.set(true);
    this.lastScrollHeight = this.scroller?.nativeElement.scrollHeight ?? 0;
    this.svc.listMessages(this.conversation.id, this.nextCursor, PAGE_SIZE).subscribe({
      next: res => {
        // Histórico mais antigo (cronológico) → prepend mantendo a ordem.
        this.messages.update(cur => [...res.data, ...cur]);
        this.nextCursor = res.nextCursor;
        this.loadingMore.set(false);
        this.preserveFromTop = true;
      },
      error: () => this.loadingMore.set(false),
    });
  }

  /** Alterna entre enviar mensagem ao cliente e registrar nota interna. */
  setNoteMode(on: boolean): void {
    this.noteMode.set(on);
    this.sendErr.set(null);
  }

  send(): void {
    const conv = this.conversation;
    if (!conv || this.form.invalid) return;
    const text = this.form.getRawValue().text.trim();
    if (!text) return;
    this.sending.set(true);
    this.sendErr.set(null);
    const isNote = this.noteMode();
    const req$ = isNote ? this.svc.addNote(conv.id, text) : this.svc.sendMessage(conv.id, text);
    req$.subscribe({
      next: msg => {
        this.messages.update(cur => [...cur, msg]);
        this.form.reset({ text: '' });
        this.sending.set(false);
        this.shouldScrollBottom = true;
      },
      error: (e: { error?: { message?: string } }) => {
        this.sending.set(false);
        this.sendErr.set(
          e?.error?.message ??
            (isNote ? 'Falha ao salvar a nota' : 'Falha ao enviar (instância desconectada?)'),
        );
      },
    });
  }

  /** Transferência bot↔humano: liga/desliga o bot da conversa. */
  toggleBot(): void {
    const conv = this.conversation;
    if (!conv || this.togglingBot()) return;
    const next = !conv.botActive;
    this.togglingBot.set(true);
    this.svc.setBotActive(conv.id, next).subscribe({
      next: () => {
        if (this.conversation?.id === conv.id) this.conversation.botActive = next;
        this.botToggled.emit({ id: conv.id, botActive: next });
        this.togglingBot.set(false);
      },
      error: () => this.togglingBot.set(false),
    });
  }

  time(iso: string): string {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
