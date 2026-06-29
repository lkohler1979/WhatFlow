import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  CampaignsService,
  type Campaign,
  type CampaignMessageType,
  type CampaignStatus,
} from './campaigns.service';
import { ContactsService, type Contact } from '../contacts/contacts.service';
import { InstancesService, type Instance } from '../instances/instances.service';
import { SocketService } from '@core/services/socket.service';

const STATUS_LABEL: Record<CampaignStatus, string> = {
  DRAFT: 'Rascunho',
  SCHEDULED: 'Agendada',
  RUNNING: 'Em execução',
  PAUSED: 'Pausada',
  COMPLETED: 'Concluída',
  CANCELLED: 'Cancelada',
  FAILED: 'Falhou',
};

const MESSAGE_LABEL: Record<CampaignMessageType, string> = {
  TEXT: 'Texto',
  IMAGE: 'Imagem',
  AUDIO: 'Áudio',
  VIDEO: 'Vídeo',
  DOCUMENT: 'Documento',
};

@Component({
  selector: 'wf-campaigns',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <section class="page">
      <header class="page-head">
        <div>
          <h1>Campanhas</h1>
          <p class="muted">{{ total() }} campanha(s)</p>
        </div>
        <button type="button" class="wf-btn" (click)="reloadAll()">Atualizar</button>
      </header>

      @if (error()) {
        <p class="error">{{ error() }}</p>
      }

      <section class="workspace">
        <form class="composer" [formGroup]="form" (ngSubmit)="create()">
          <div class="section-head">
            <strong>Nova campanha</strong>
            <span class="muted">{{ selectedCount() }} selecionado(s)</span>
          </div>

          <label>
            <span>Nome</span>
            <input class="wf-input" formControlName="name" placeholder="Campanha" />
          </label>

          <label>
            <span>Instância</span>
            <select class="wf-input" formControlName="instanceId">
              <option value="">Selecione</option>
              @for (inst of instances(); track inst.id) {
                <option [value]="inst.id">{{ inst.name }} · {{ inst.status }}</option>
              }
            </select>
          </label>

          <div class="split">
            <label>
              <span>Tipo</span>
              <select class="wf-input" formControlName="messageType">
                <option value="TEXT">Texto</option>
                <option value="IMAGE">Imagem</option>
                <option value="AUDIO">Áudio</option>
                <option value="VIDEO">Vídeo</option>
                <option value="DOCUMENT">Documento</option>
              </select>
            </label>
            <label>
              <span>Agendamento</span>
              <input class="wf-input" type="datetime-local" formControlName="scheduledAt" />
            </label>
          </div>

          <label>
            <span>{{ form.controls.messageType.value === 'TEXT' ? 'Mensagem' : 'Legenda' }}</span>
            <textarea
              class="wf-input"
              rows="4"
              formControlName="messageContent"
              placeholder="Texto da mensagem"
            ></textarea>
          </label>

          @if (form.controls.messageType.value !== 'TEXT') {
            <label>
              <span>URL da mídia</span>
              <input class="wf-input" formControlName="mediaUrl" placeholder="https://..." />
            </label>
          }

          <div class="split">
            <label>
              <span>Delay mínimo (ms)</span>
              <input class="wf-input" type="number" formControlName="delayMinMs" />
            </label>
            <label>
              <span>Delay máximo (ms)</span>
              <input class="wf-input" type="number" formControlName="delayMaxMs" />
            </label>
          </div>

          <div class="contacts-box">
            <div class="section-head">
              <strong>Contatos</strong>
              <button type="button" class="link-btn" (click)="toggleAllFiltered()">
                {{ allFilteredSelected() ? 'Limpar seleção' : 'Selecionar visíveis' }}
              </button>
            </div>
            <input
              class="wf-input"
              [formControl]="contactSearchCtrl"
              placeholder="Buscar contatos"
            />
            <div class="contact-list">
              @if (contactsLoading()) {
                <p class="muted">Carregando...</p>
              } @else if (filteredContacts().length === 0) {
                <p class="muted">Nenhum contato disponível.</p>
              } @else {
                @for (contact of filteredContacts(); track contact.id) {
                  <label class="contact-row">
                    <input
                      type="checkbox"
                      [checked]="isSelected(contact.id)"
                      (change)="toggleContact(contact.id)"
                    />
                    <span>
                      <strong>{{ contact.name || contact.phone }}</strong>
                      <small>{{ contact.phone }}</small>
                    </span>
                  </label>
                }
              }
            </div>
          </div>

          <button
            class="wf-btn wf-btn--primary"
            type="submit"
            [disabled]="!canCreate() || creating()"
          >
            {{ creating() ? 'Criando...' : 'Criar campanha' }}
          </button>
        </form>

        <section class="campaign-list">
          <div class="section-head">
            <strong>Campanhas</strong>
            <select
              class="wf-input status-filter"
              [formControl]="statusCtrl"
              (change)="loadCampaigns()"
            >
              <option value="">Todas</option>
              <option value="DRAFT">Rascunho</option>
              <option value="SCHEDULED">Agendada</option>
              <option value="RUNNING">Em execução</option>
              <option value="PAUSED">Pausada</option>
              <option value="COMPLETED">Concluída</option>
              <option value="CANCELLED">Cancelada</option>
              <option value="FAILED">Falhou</option>
            </select>
          </div>

          @if (loading()) {
            <p class="muted">Carregando...</p>
          } @else if (campaigns().length === 0) {
            <p class="muted">Nenhuma campanha encontrada.</p>
          } @else {
            <div class="rows">
              @for (campaign of campaigns(); track campaign.id) {
                <article class="campaign">
                  <div class="campaign-top">
                    <div>
                      <strong>{{ campaign.name }}</strong>
                      <p class="muted">
                        {{ messageLabel(campaign.messageType) }} ·
                        {{ campaign.totalContacts }} contato(s)
                      </p>
                    </div>
                    <span class="badge" [class]="statusClass(campaign.status)">{{
                      label(campaign.status)
                    }}</span>
                  </div>

                  <div class="progress">
                    <div class="progress-bar">
                      <span [style.width.%]="progress(campaign)"></span>
                    </div>
                    <div class="progress-meta">
                      <span>{{ campaign.sentCount }} enviado(s)</span>
                      <span>{{ campaign.failedCount }} falha(s)</span>
                      <span>{{ progress(campaign) }}%</span>
                    </div>
                  </div>

                  <div class="actions">
                    <button
                      type="button"
                      class="wf-btn wf-btn--primary"
                      (click)="start(campaign)"
                      [disabled]="!canStart(campaign)"
                    >
                      Iniciar
                    </button>
                    <button
                      type="button"
                      class="wf-btn"
                      (click)="pause(campaign)"
                      [disabled]="campaign.status !== 'RUNNING'"
                    >
                      Pausar
                    </button>
                    <button
                      type="button"
                      class="wf-btn"
                      (click)="cancel(campaign)"
                      [disabled]="isTerminal(campaign.status)"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      class="wf-btn wf-btn--danger"
                      (click)="remove(campaign)"
                      [disabled]="!canRemove(campaign)"
                    >
                      Excluir
                    </button>
                  </div>
                </article>
              }
            </div>
          }
        </section>
      </section>
    </section>
  `,
  styles: [
    `
      .page {
        padding: 1.5rem 2rem;
      }
      .page-head,
      .section-head,
      .campaign-top,
      .progress-meta,
      .actions {
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
      .workspace {
        display: grid;
        grid-template-columns: minmax(340px, 420px) minmax(420px, 1fr);
        gap: 1rem;
        align-items: start;
      }
      .composer,
      .campaign-list {
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 1rem;
      }
      .composer {
        display: grid;
        gap: 0.75rem;
      }
      .composer label {
        display: grid;
        gap: 0.35rem;
        font-size: 0.85rem;
        font-weight: 600;
      }
      .composer textarea {
        resize: vertical;
      }
      .split {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
      }
      .section-head {
        justify-content: space-between;
      }
      .status-filter {
        width: 180px;
      }
      .link-btn {
        border: 0;
        background: transparent;
        color: #2563eb;
        cursor: pointer;
        font: inherit;
      }
      .contacts-box {
        display: grid;
        gap: 0.65rem;
        border: 1px solid #eef2f7;
        border-radius: 8px;
        padding: 0.75rem;
      }
      .contact-list {
        max-height: 260px;
        overflow: auto;
        display: grid;
        gap: 0.35rem;
      }
      .contact-row {
        display: grid;
        grid-template-columns: auto 1fr;
        align-items: center;
        gap: 0.6rem;
        padding: 0.5rem;
        border-radius: 6px;
        background: #f8fafc;
      }
      .contact-row span {
        display: grid;
        gap: 0.1rem;
      }
      .contact-row small {
        color: #667085;
      }
      .rows {
        display: grid;
        gap: 0.75rem;
      }
      .campaign {
        border: 1px solid #eef2f7;
        border-radius: 8px;
        padding: 1rem;
      }
      .campaign-top {
        justify-content: space-between;
        align-items: flex-start;
      }
      .badge {
        display: inline-flex;
        white-space: nowrap;
        border-radius: 999px;
        padding: 0.18rem 0.55rem;
        font-size: 0.75rem;
        background: #e5e7eb;
        color: #374151;
      }
      .badge.running {
        background: #dbeafe;
        color: #1d4ed8;
      }
      .badge.done {
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
      .progress {
        display: grid;
        gap: 0.4rem;
        margin: 1rem 0;
      }
      .progress-bar {
        height: 10px;
        background: #eef2f7;
        border-radius: 999px;
        overflow: hidden;
      }
      .progress-bar span {
        display: block;
        height: 100%;
        background: #2563eb;
      }
      .progress-meta {
        justify-content: space-between;
        color: #667085;
        font-size: 0.82rem;
      }
      .actions {
        flex-wrap: wrap;
      }
      .error {
        color: #b42318;
        margin-bottom: 0.75rem;
      }
      @media (max-width: 980px) {
        .workspace,
        .split {
          grid-template-columns: 1fr;
        }
        .page-head,
        .section-head {
          align-items: stretch;
          flex-direction: column;
        }
        .status-filter {
          width: 100%;
        }
      }
    `,
  ],
})
export class CampaignsComponent implements OnInit {
  private campaignsSvc = inject(CampaignsService);
  private contactsSvc = inject(ContactsService);
  private instancesSvc = inject(InstancesService);
  private socket = inject(SocketService);
  private fb = inject(FormBuilder);

  campaigns = signal<Campaign[]>([]);
  contacts = signal<Contact[]>([]);
  instances = signal<Instance[]>([]);
  total = signal(0);
  loading = signal(true);
  contactsLoading = signal(true);
  creating = signal(false);
  error = signal<string | null>(null);
  selected = signal<Set<string>>(new Set());

  statusCtrl = this.fb.nonNullable.control('');
  contactSearchCtrl = this.fb.nonNullable.control('');
  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    instanceId: ['', [Validators.required]],
    messageType: ['TEXT' as CampaignMessageType, [Validators.required]],
    messageContent: ['', [Validators.required]],
    mediaUrl: [''],
    scheduledAt: [''],
    delayMinMs: [3000, [Validators.required, Validators.min(1000)]],
    delayMaxMs: [8000, [Validators.required, Validators.min(1000)]],
  });

  filteredContacts = computed(() => {
    const q = this.contactSearchCtrl.value.trim().toLowerCase();
    if (!q) return this.contacts();
    return this.contacts().filter(c =>
      [c.name ?? '', c.phone, c.email ?? ''].some(v => v.toLowerCase().includes(q)),
    );
  });
  selectedCount = computed(() => this.selected().size);
  allFilteredSelected = computed(() => {
    const contacts = this.filteredContacts();
    return contacts.length > 0 && contacts.every(c => this.selected().has(c.id));
  });

  constructor() {
    effect(
      () => {
        const evt = this.socket.campaignProgress();
        if (!evt) return;
        this.campaigns.update(list =>
          list.map(c =>
            c.id === evt.campaignId
              ? {
                  ...c,
                  status: evt.status,
                  sentCount: evt.sent,
                  failedCount: evt.failed,
                  totalContacts: evt.total,
                }
              : c,
          ),
        );
      },
      { allowSignalWrites: true },
    );
  }

  ngOnInit(): void {
    this.socket.connect();
    this.reloadAll();
  }

  reloadAll(): void {
    this.loadCampaigns();
    this.loadContacts();
    this.loadInstances();
  }

  loadCampaigns(): void {
    this.loading.set(true);
    const status = this.statusCtrl.value as CampaignStatus | '';
    this.campaignsSvc.list({ status: status || undefined, pageSize: 50 }).subscribe({
      next: res => {
        this.campaigns.set(res.data);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: (e: { error?: { message?: string } }) => {
        this.error.set(e?.error?.message ?? 'Falha ao carregar campanhas');
        this.loading.set(false);
      },
    });
  }

  loadContacts(): void {
    this.contactsLoading.set(true);
    this.contactsSvc.list({ pageSize: 100 }).subscribe({
      next: res => {
        this.contacts.set(res.data.filter(c => !c.isBlocked && !c.isOptedOut));
        this.contactsLoading.set(false);
      },
      error: () => {
        this.contactsLoading.set(false);
      },
    });
  }

  loadInstances(): void {
    this.instancesSvc.list().subscribe({
      next: res => this.instances.set(res.data),
      error: () => undefined,
    });
  }

  canCreate(): boolean {
    const raw = this.form.getRawValue();
    const validDelay = Number(raw.delayMinMs) <= Number(raw.delayMaxMs);
    const hasMessage = raw.messageType !== 'TEXT' || raw.messageContent.trim().length > 0;
    const hasMedia = raw.messageType === 'TEXT' || raw.mediaUrl.trim().length > 0;
    return this.form.valid && validDelay && hasMessage && hasMedia && this.selectedCount() > 0;
  }

  create(): void {
    if (!this.canCreate()) return;
    this.creating.set(true);
    this.error.set(null);
    const raw = this.form.getRawValue();
    this.campaignsSvc
      .create({
        name: raw.name.trim(),
        instanceId: raw.instanceId,
        messageType: raw.messageType,
        messageContent: raw.messageContent.trim() || null,
        mediaUrl: raw.mediaUrl.trim() || null,
        mediaCaption: raw.messageType === 'TEXT' ? null : raw.messageContent.trim() || null,
        scheduledAt: raw.scheduledAt ? new Date(raw.scheduledAt).toISOString() : null,
        delayMinMs: Number(raw.delayMinMs),
        delayMaxMs: Number(raw.delayMaxMs),
        contactIds: [...this.selected()],
      })
      .subscribe({
        next: () => {
          this.creating.set(false);
          this.selected.set(new Set());
          this.form.reset({
            name: '',
            instanceId: '',
            messageType: 'TEXT',
            messageContent: '',
            mediaUrl: '',
            scheduledAt: '',
            delayMinMs: 3000,
            delayMaxMs: 8000,
          });
          this.loadCampaigns();
        },
        error: (e: { error?: { message?: string } }) => {
          this.error.set(e?.error?.message ?? 'Falha ao criar campanha');
          this.creating.set(false);
        },
      });
  }

  isSelected(id: string): boolean {
    return this.selected().has(id);
  }

  toggleContact(id: string): void {
    this.selected.update(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  toggleAllFiltered(): void {
    const visible = this.filteredContacts();
    const all = this.allFilteredSelected();
    this.selected.update(current => {
      const next = new Set(current);
      visible.forEach(c => {
        if (all) next.delete(c.id);
        else next.add(c.id);
      });
      return next;
    });
  }

  start(campaign: Campaign): void {
    if (!this.canStart(campaign)) return;
    this.campaignsSvc.start(campaign.id).subscribe({
      next: updated => this.patchCampaign(updated),
      error: (e: { error?: { message?: string } }) =>
        this.error.set(e?.error?.message ?? 'Falha ao iniciar campanha'),
    });
  }

  pause(campaign: Campaign): void {
    this.campaignsSvc.pause(campaign.id).subscribe({
      next: updated => this.patchCampaign(updated),
      error: (e: { error?: { message?: string } }) =>
        this.error.set(e?.error?.message ?? 'Falha ao pausar campanha'),
    });
  }

  cancel(campaign: Campaign): void {
    if (!confirm(`Cancelar "${campaign.name}"?`)) return;
    this.campaignsSvc.cancel(campaign.id).subscribe({
      next: updated => this.patchCampaign(updated),
      error: (e: { error?: { message?: string } }) =>
        this.error.set(e?.error?.message ?? 'Falha ao cancelar campanha'),
    });
  }

  remove(campaign: Campaign): void {
    if (!confirm(`Excluir "${campaign.name}"?`)) return;
    this.campaignsSvc.remove(campaign.id).subscribe({
      next: () => this.loadCampaigns(),
      error: (e: { error?: { message?: string } }) =>
        this.error.set(e?.error?.message ?? 'Falha ao excluir campanha'),
    });
  }

  patchCampaign(updated: Campaign): void {
    this.campaigns.update(list => list.map(c => (c.id === updated.id ? { ...c, ...updated } : c)));
  }

  canStart(campaign: Campaign): boolean {
    return ['DRAFT', 'SCHEDULED', 'PAUSED'].includes(campaign.status);
  }

  canRemove(campaign: Campaign): boolean {
    return ['DRAFT', 'SCHEDULED'].includes(campaign.status);
  }

  isTerminal(status: CampaignStatus): boolean {
    return ['COMPLETED', 'CANCELLED', 'FAILED'].includes(status);
  }

  progress(campaign: Campaign): number {
    const total = campaign.totalContacts || 0;
    if (total === 0) return 0;
    return Math.min(100, Math.round(((campaign.sentCount + campaign.failedCount) / total) * 100));
  }

  label(status: CampaignStatus): string {
    return STATUS_LABEL[status] ?? status;
  }

  messageLabel(type: CampaignMessageType): string {
    return MESSAGE_LABEL[type] ?? type;
  }

  statusClass(status: CampaignStatus): string {
    if (status === 'RUNNING') return 'running';
    if (status === 'COMPLETED') return 'done';
    if (status === 'DRAFT' || status === 'SCHEDULED' || status === 'PAUSED') return 'warn';
    return 'danger';
  }
}
