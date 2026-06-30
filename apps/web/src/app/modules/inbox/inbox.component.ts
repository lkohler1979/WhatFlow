import { Component, OnInit, ViewChild, inject, signal } from '@angular/core';
import { SocketService } from '@core/services/socket.service';
import { Conversation } from './inbox.service';
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
        <wf-chat-window [selected]="selected()" (read)="onRead($event)" />
      </section>
      <aside class="col col-info">
        <wf-contact-info-panel [conversation]="selected()" />
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

  selected = signal<Conversation | null>(null);

  ngOnInit(): void {
    // Prepara o canal realtime; o consumo dos eventos é o T-038.
    this.socket.connect();
  }

  onSelect(conv: Conversation): void {
    this.selected.set(conv);
  }

  onRead(id: string): void {
    this.list?.clearUnread(id);
    this.selected.update(c => (c && c.id === id ? { ...c, unreadCount: 0 } : c));
  }
}
