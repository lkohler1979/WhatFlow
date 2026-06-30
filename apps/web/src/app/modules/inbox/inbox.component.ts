import { Component, OnInit, ViewChild, effect, inject, signal } from '@angular/core';
import { SocketService } from '@core/services/socket.service';
import { Conversation, ConversationStatus, ConversationTag, Message } from './inbox.service';
import { ConversationListComponent } from './components/conversation-list/conversation-list.component';
import { ChatWindowComponent } from './components/chat-window/chat-window.component';
import { ContactInfoPanelComponent } from './components/contact-info-panel/contact-info-panel.component';

@Component({
  selector: 'wf-inbox',
  standalone: true,
  imports: [ConversationListComponent, ChatWindowComponent, ContactInfoPanelComponent],
  template: `
    <div class="inbox">
      <aside class="col col-list">
        <wf-conversation-list [selectedId]="selected()?.id ?? null" (select)="onSelect($event)" />
      </aside>
      <section class="col col-chat">
        <wf-chat-window
          [selected]="selected()"
          (read)="onRead($event)"
          (botToggled)="onBotToggled($event)"
        />
      </section>
      <aside class="col col-info">
        <wf-contact-info-panel [conversation]="selected()" (tagsChanged)="onTagsChanged($event)" />
      </aside>
    </div>
  `,
  styles: [
    `
      .inbox {
        display: grid;
        grid-template-columns: 320px 1fr 280px;
        height: 100%;
        min-height: 0;
      }
      .col {
        min-height: 0;
        overflow: hidden;
        background: #fff;
      }
      .col-list {
        border-right: 1px solid #e4e9f0;
      }
      .col-info {
        border-left: 1px solid #e4e9f0;
        overflow-y: auto;
      }
      @media (max-width: 1100px) {
        .inbox {
          grid-template-columns: 280px 1fr;
        }
        .col-info {
          display: none;
        }
      }
    `,
  ],
})
export class InboxComponent implements OnInit {
  private socket = inject(SocketService);

  @ViewChild(ConversationListComponent) private list?: ConversationListComponent;
  @ViewChild(ChatWindowComponent) private chat?: ChatWindowComponent;

  selected = signal<Conversation | null>(null);

  constructor() {
    // ── Realtime (Socket.io) ──
    // message:new — mensagem nova (do agente ou recebida via webhook).
    effect(
      () => {
        const evt = this.socket.lastMessage();
        if (!evt) return;
        const openId = this.selected()?.id ?? null;
        const isOpen = openId === evt.conversationId;
        const preview = evt.message?.content ?? evt.preview ?? '';
        const isOutbound = evt.message?.direction === 'OUTBOUND';

        // Se é a conversa aberta, acrescenta no chat em tempo real.
        if (isOpen && this.chat) {
          const msg: Message = evt.message ?? {
            id: `rt-${evt.conversationId}-${Math.random().toString(36).slice(2)}`,
            direction: 'INBOUND',
            content: preview,
            type: 'TEXT',
            status: 'DELIVERED',
            timestamp: new Date().toISOString(),
          };
          this.chat.appendIncoming(evt.conversationId, msg);
        }

        // Lista: preview/topo sempre; badge só p/ inbound de conversa não aberta.
        this.list?.applyIncoming(evt.conversationId, preview, !isOpen && !isOutbound);
      },
      { allowSignalWrites: true },
    );

    // conversation:updated — status/atribuição/preview.
    effect(
      () => {
        const evt = this.socket.conversationUpdated();
        if (!evt) return;
        const patch: Partial<Conversation> = {};
        if (evt.status) patch.status = evt.status as ConversationStatus;
        if (evt.botActive !== undefined) patch.botActive = evt.botActive;
        if (evt.unreadCount !== undefined) patch.unreadCount = evt.unreadCount;
        if (evt.lastMessagePreview !== undefined) patch.lastMessagePreview = evt.lastMessagePreview;
        if (evt.lastMessageAt !== undefined) patch.lastMessageAt = evt.lastMessageAt;
        this.list?.applyUpdate(evt.id, patch);
        this.selected.update(c => (c && c.id === evt.id ? { ...c, ...patch } : c));
      },
      { allowSignalWrites: true },
    );

    // conversation:read — zera badge de não lidos.
    effect(
      () => {
        const evt = this.socket.conversationRead();
        if (!evt) return;
        this.list?.clearUnread(evt.id);
        this.selected.update(c => (c && c.id === evt.id ? { ...c, unreadCount: 0 } : c));
      },
      { allowSignalWrites: true },
    );
  }

  ngOnInit(): void {
    this.socket.connect();
  }

  onSelect(conv: Conversation): void {
    this.selected.set(conv);
  }

  onRead(id: string): void {
    this.list?.clearUnread(id);
    this.selected.update(c => (c && c.id === id ? { ...c, unreadCount: 0 } : c));
  }

  onBotToggled(ev: { id: string; botActive: boolean }): void {
    this.list?.applyUpdate(ev.id, { botActive: ev.botActive });
    this.selected.update(c => (c && c.id === ev.id ? { ...c, botActive: ev.botActive } : c));
  }

  /** Reflete as tags da conversa na lista e na conversa selecionada (T-040). */
  onTagsChanged(ev: { id: string; tags: ConversationTag[] }): void {
    this.list?.applyUpdate(ev.id, { tags: ev.tags });
    this.selected.update(c => (c && c.id === ev.id ? { ...c, tags: ev.tags } : c));
  }
}
