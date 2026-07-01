import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  WEBHOOK_EVENTS,
  WEBHOOK_EVENT_LABELS,
  WebhooksService,
  type CreateWebhookPayload,
  type WebhookEvent,
  type WebhookView,
} from '../webhook-list/webhooks.service';

/**
 * Modal de criação/edição de webhook. Em edição recebe `webhook` (sem secret —
 * usamos hasSecret para sinalizar que já existe um). O campo secret só é enviado
 * quando o usuário digita algo (na criação, vazio = gerado pelo backend).
 */
@Component({
  selector: 'wf-webhook-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './webhook-form.component.html',
  styleUrl: './webhook-form.component.scss',
})
export class WebhookFormComponent implements OnInit {
  @Input() webhook: WebhookView | null = null;
  @Output() saved = new EventEmitter<WebhookView>();
  @Output() closed = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private svc = inject(WebhooksService);

  readonly allEvents = WEBHOOK_EVENTS;
  readonly eventLabels = WEBHOOK_EVENT_LABELS;

  saving = signal(false);
  error = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    url: ['', [Validators.required, Validators.maxLength(500)]],
    secret: [''],
    isActive: [true],
    events: this.fb.array(this.allEvents.map(() => this.fb.nonNullable.control(false))),
  });

  get eventsArray(): FormArray {
    return this.form.controls.events;
  }

  get isEdit(): boolean {
    return !!this.webhook;
  }

  ngOnInit(): void {
    if (this.webhook) {
      const selected = new Set(this.webhook.events);
      this.form.patchValue({
        name: this.webhook.name,
        url: this.webhook.url,
        isActive: this.webhook.isActive,
      });
      this.allEvents.forEach((ev, i) => this.eventsArray.at(i).setValue(selected.has(ev)));
    }
  }

  /** Ao menos um evento marcado? */
  hasEvent(): boolean {
    return this.selectedEvents().length > 0;
  }

  private selectedEvents(): WebhookEvent[] {
    return this.allEvents.filter((_, i) => this.eventsArray.at(i).value === true);
  }

  secretPlaceholder(): string {
    if (this.isEdit) {
      return this.webhook?.hasSecret
        ? 'Segredo definido — deixe em branco para manter'
        : 'Sem segredo';
    }
    return 'Opcional — gerado automaticamente se vazio';
  }

  submit(): void {
    if (this.form.invalid || !this.hasEvent()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);

    const raw = this.form.getRawValue();
    const events = this.selectedEvents();
    const secret = raw.secret.trim();

    const request$ = this.isEdit
      ? this.svc.update(this.webhook!.id, {
          name: raw.name.trim(),
          url: raw.url.trim(),
          events,
          isActive: raw.isActive,
          // secret só vai se o usuário digitou algo (preserva o atual se vazio).
          ...(secret ? { secret } : {}),
        })
      : this.svc.create({
          name: raw.name.trim(),
          url: raw.url.trim(),
          events,
          isActive: raw.isActive,
          ...(secret ? { secret } : {}),
        } as CreateWebhookPayload);

    request$.subscribe({
      next: w => {
        this.saving.set(false);
        this.saved.emit(w);
      },
      error: (e: { error?: { message?: string } }) => {
        this.error.set(e?.error?.message ?? 'Falha ao salvar webhook');
        this.saving.set(false);
      },
    });
  }

  cancel(): void {
    this.closed.emit();
  }
}
