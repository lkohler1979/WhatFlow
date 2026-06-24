import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { InstancesService, Instance, InstanceStatus } from './instances.service';

const STATUS_LABEL: Record<InstanceStatus, string> = {
  PENDING: 'Pendente',
  QR_PENDING: 'Aguardando QR',
  CONNECTED: 'Conectada',
  DISCONNECTED: 'Desconectada',
  BANNED: 'Banida',
};

@Component({
  selector: 'wf-instances',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <section class="page">
      <header class="page-head">
        <h1>Instâncias WhatsApp</h1>
        <form class="create" [formGroup]="form" (ngSubmit)="create()">
          <input formControlName="name" placeholder="Nome da instância" />
          <button type="submit" [disabled]="form.invalid || creating()">
            {{ creating() ? 'Criando...' : 'Nova instância' }}
          </button>
        </form>
      </header>

      @if (error()) {
        <p class="error">{{ error() }}</p>
      }

      @if (loading()) {
        <p class="muted">Carregando...</p>
      } @else if (instances().length === 0) {
        <p class="muted">Nenhuma instância ainda. Crie a primeira acima.</p>
      } @else {
        <div class="grid">
          @for (inst of instances(); track inst.id) {
            <article class="card">
              <div class="card-top">
                <strong>{{ inst.name }}</strong>
                <span class="badge" [class]="'st-' + inst.status">{{ label(inst.status) }}</span>
              </div>
              <p class="phone">{{ inst.phone || 'sem número' }}</p>
              <div class="actions">
                <button (click)="openQr(inst)">QR Code</button>
                <button (click)="refresh(inst)">Atualizar</button>
                <button class="danger" (click)="remove(inst)">Excluir</button>
              </div>
            </article>
          }
        </div>
      }

      @if (qrFor()) {
        <div class="modal-backdrop" (click)="closeQr()">
          <div class="modal" (click)="$event.stopPropagation()">
            <h2>Conectar "{{ qrFor()?.name }}"</h2>
            <p class="muted">WhatsApp › Aparelhos conectados › Conectar aparelho.</p>
            @if (qrImage()) {
              <img class="qr" [src]="qrImage()" alt="QR Code" />
            } @else {
              <p class="muted">Gerando QR Code...</p>
            }
            <p class="status">
              Status: <strong>{{ label(qrStatus()) }}</strong>
            </p>
            <div class="actions center">
              <button (click)="reloadQr()">Recarregar QR</button>
              <button class="danger" (click)="closeQr()">Fechar</button>
            </div>
          </div>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .page {
        padding: 1.5rem 2rem;
      }
      .page-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
        margin-bottom: 1.25rem;
      }
      h1 {
        font-size: 1.5rem;
      }
      .create {
        display: flex;
        gap: 0.5rem;
      }
      .create input {
        padding: 0.55rem 0.7rem;
        border: 1px solid #d0d5dd;
        border-radius: 8px;
      }
      button {
        padding: 0.5rem 0.9rem;
        border: 1px solid #d0d5dd;
        border-radius: 8px;
        background: #fff;
        cursor: pointer;
        font-weight: 600;
      }
      .create button {
        background: #1a5276;
        color: #fff;
        border-color: #1a5276;
      }
      button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .danger {
        color: #b42318;
        border-color: #f3b0aa;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 1rem;
      }
      .card {
        padding: 1rem;
        border-radius: 12px;
        background: #fff;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
      }
      .card-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .phone {
        opacity: 0.6;
        font-size: 0.85rem;
        margin: 0.4rem 0 0.8rem;
      }
      .actions {
        display: flex;
        gap: 0.4rem;
        flex-wrap: wrap;
      }
      .actions.center {
        justify-content: center;
      }
      .badge {
        font-size: 0.7rem;
        padding: 0.15rem 0.5rem;
        border-radius: 999px;
        background: #eee;
      }
      .st-CONNECTED {
        background: #d1fae5;
        color: #065f46;
      }
      .st-QR_PENDING {
        background: #fef3c7;
        color: #92400e;
      }
      .st-DISCONNECTED,
      .st-BANNED {
        background: #fee2e2;
        color: #991b1b;
      }
      .muted {
        opacity: 0.65;
      }
      .error {
        color: #b42318;
      }
      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 50;
      }
      .modal {
        background: #fff;
        border-radius: 12px;
        padding: 1.5rem;
        width: 340px;
        text-align: center;
      }
      .qr {
        width: 256px;
        height: 256px;
        object-fit: contain;
        margin: 0.5rem auto;
      }
      .status {
        margin: 0.5rem 0;
      }
    `,
  ],
})
export class InstancesComponent implements OnInit, OnDestroy {
  private svc = inject(InstancesService);
  private fb = inject(FormBuilder);
  private sanitizer = inject(DomSanitizer);

  instances = signal<Instance[]>([]);
  loading = signal(true);
  creating = signal(false);
  error = signal<string | null>(null);

  qrFor = signal<Instance | null>(null);
  qrImage = signal<SafeUrl | null>(null);
  qrStatus = signal<InstanceStatus>('QR_PENDING');

  private poll: ReturnType<typeof setInterval> | null = null;

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
  });

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.stopPoll();
  }

  label(s: InstanceStatus): string {
    return STATUS_LABEL[s] ?? s;
  }

  load(): void {
    this.loading.set(true);
    this.svc.list().subscribe({
      next: res => {
        this.instances.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Falha ao carregar instâncias');
        this.loading.set(false);
      },
    });
  }

  create(): void {
    if (this.form.invalid) return;
    this.creating.set(true);
    this.error.set(null);
    this.svc.create(this.form.getRawValue().name).subscribe({
      next: () => {
        this.form.reset({ name: '' });
        this.creating.set(false);
        this.load();
      },
      error: (e: { error?: { message?: string } }) => {
        this.error.set(e?.error?.message ?? 'Falha ao criar instância');
        this.creating.set(false);
      },
    });
  }

  refresh(inst: Instance): void {
    this.svc.get(inst.id).subscribe({
      next: updated =>
        this.instances.update(list => list.map(i => (i.id === updated.id ? updated : i))),
    });
  }

  remove(inst: Instance): void {
    if (!confirm(`Excluir a instância "${inst.name}"?`)) return;
    this.svc.remove(inst.id).subscribe({ next: () => this.load() });
  }

  openQr(inst: Instance): void {
    this.qrFor.set(inst);
    this.qrImage.set(null);
    this.qrStatus.set(inst.status);
    this.reloadQr();
    this.startPoll(inst.id);
  }

  reloadQr(): void {
    const inst = this.qrFor();
    if (!inst) return;
    this.svc.qrCode(inst.id).subscribe({
      next: res => {
        if (res.qrCode) this.qrImage.set(this.sanitizer.bypassSecurityTrustUrl(res.qrCode));
        this.qrStatus.set(res.status);
      },
    });
  }

  private startPoll(id: string): void {
    this.stopPoll();
    this.poll = setInterval(() => {
      this.svc.get(id).subscribe({
        next: updated => {
          this.qrStatus.set(updated.status);
          this.instances.update(list => list.map(i => (i.id === id ? updated : i)));
          if (updated.status === 'CONNECTED') this.stopPoll();
        },
      });
    }, 3000);
  }

  private stopPoll(): void {
    if (this.poll) {
      clearInterval(this.poll);
      this.poll = null;
    }
  }

  closeQr(): void {
    this.stopPoll();
    this.qrFor.set(null);
    this.qrImage.set(null);
  }
}
