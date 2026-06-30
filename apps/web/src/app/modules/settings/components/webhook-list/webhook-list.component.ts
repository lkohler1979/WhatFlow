import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { WebhookFormComponent } from '../webhook-form/webhook-form.component';
import {
  WEBHOOK_EVENT_LABELS,
  WebhooksService,
  type Paginated,
  type WebhookDelivery,
  type WebhookEvent,
  type WebhookView,
} from './webhooks.service';

const DELIVERY_PAGE_SIZE = 10;

const STATUS_BADGE: Record<WebhookDelivery['status'], string> = {
  SUCCESS: 'wf-badge--success',
  FAILED: 'wf-badge--danger',
  RETRYING: 'wf-badge--warning',
  PENDING: 'wf-badge--warning',
};

const STATUS_LABEL: Record<WebhookDelivery['status'], string> = {
  SUCCESS: 'Sucesso',
  FAILED: 'Falha',
  RETRYING: 'Retentando',
  PENDING: 'Pendente',
};

@Component({
  selector: 'wf-webhook-list',
  standalone: true,
  imports: [WebhookFormComponent],
  templateUrl: './webhook-list.component.html',
  styleUrl: './webhook-list.component.scss',
})
export class WebhookListComponent implements OnInit {
  private svc = inject(WebhooksService);

  readonly eventLabels = WEBHOOK_EVENT_LABELS;
  readonly statusBadge = STATUS_BADGE;
  readonly statusLabel = STATUS_LABEL;

  webhooks = signal<WebhookView[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  // Modal de criação/edição.
  formOpen = signal(false);
  editing = signal<WebhookView | null>(null);

  // Painel de histórico de entregas.
  expandedId = signal<string | null>(null);
  deliveries = signal<WebhookDelivery[]>([]);
  deliveriesLoading = signal(false);
  deliveriesError = signal<string | null>(null);
  deliveryPage = signal(1);
  deliveryTotal = signal(0);
  testingId = signal<string | null>(null);

  readonly deliveryPageSize = DELIVERY_PAGE_SIZE;
  totalPages = computed(() => Math.max(1, Math.ceil(this.deliveryTotal() / this.deliveryPageSize)));

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.list().subscribe({
      next: res => {
        this.webhooks.set(res.data);
        this.loading.set(false);
      },
      error: (e: { error?: { message?: string } }) => {
        this.error.set(e?.error?.message ?? 'Falha ao carregar webhooks');
        this.loading.set(false);
      },
    });
  }

  eventLabel(ev: WebhookEvent): string {
    return this.eventLabels[ev] ?? ev;
  }

  // ── Criação / edição ──

  openCreate(): void {
    this.editing.set(null);
    this.formOpen.set(true);
  }

  openEdit(w: WebhookView): void {
    this.editing.set(w);
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.editing.set(null);
  }

  onSaved(): void {
    this.closeForm();
    this.load();
  }

  remove(w: WebhookView): void {
    if (!confirm(`Excluir o webhook "${w.name}"? Esta ação não pode ser desfeita.`)) return;
    this.svc.remove(w.id).subscribe({
      next: () => {
        if (this.expandedId() === w.id) this.expandedId.set(null);
        this.load();
      },
      error: (e: { error?: { message?: string } }) => {
        this.error.set(e?.error?.message ?? 'Falha ao excluir webhook');
      },
    });
  }

  // ── Histórico de entregas ──

  toggleDeliveries(w: WebhookView): void {
    if (this.expandedId() === w.id) {
      this.expandedId.set(null);
      return;
    }
    this.expandedId.set(w.id);
    this.deliveryPage.set(1);
    this.loadDeliveries(w.id, 1);
  }

  loadDeliveries(id: string, page: number): void {
    this.deliveriesLoading.set(true);
    this.deliveriesError.set(null);
    this.svc.deliveries(id, page, this.deliveryPageSize).subscribe({
      next: (res: Paginated<WebhookDelivery>) => {
        this.deliveries.set(res.data);
        this.deliveryTotal.set(res.total);
        this.deliveryPage.set(res.page);
        this.deliveriesLoading.set(false);
      },
      error: (e: { error?: { message?: string } }) => {
        this.deliveriesError.set(e?.error?.message ?? 'Falha ao carregar entregas');
        this.deliveriesLoading.set(false);
      },
    });
  }

  refreshDeliveries(): void {
    const id = this.expandedId();
    if (id) this.loadDeliveries(id, this.deliveryPage());
  }

  prevPage(): void {
    const id = this.expandedId();
    if (id && this.deliveryPage() > 1) this.loadDeliveries(id, this.deliveryPage() - 1);
  }

  nextPage(): void {
    const id = this.expandedId();
    if (id && this.deliveryPage() < this.totalPages()) {
      this.loadDeliveries(id, this.deliveryPage() + 1);
    }
  }

  // ── Teste ──

  test(w: WebhookView): void {
    this.testingId.set(w.id);
    this.svc.test(w.id).subscribe({
      next: () => {
        this.testingId.set(null);
        // Abre/garante o histórico do webhook testado e recarrega na 1ª página,
        // onde o delivery de teste (PENDING) aparece e depois atualiza.
        this.expandedId.set(w.id);
        this.deliveryPage.set(1);
        this.loadDeliveries(w.id, 1);
      },
      error: (e: { error?: { message?: string } }) => {
        this.testingId.set(null);
        this.deliveriesError.set(e?.error?.message ?? 'Falha ao disparar teste');
        this.expandedId.set(w.id);
      },
    });
  }

  durationMs(d: WebhookDelivery): number | null {
    const v = d.payload?.durationMs;
    return typeof v === 'number' ? v : null;
  }

  formatDate(value: string | null): string {
    if (!value) return '—';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(value));
  }
}
