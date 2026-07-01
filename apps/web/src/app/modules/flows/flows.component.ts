import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FlowsService } from './flows.service';
import type { Flow, FlowStatus } from './flows.models';

const STATUS_LABEL: Record<FlowStatus, string> = {
  DRAFT: 'Rascunho',
  PUBLISHED: 'Publicado',
  ARCHIVED: 'Arquivado',
};

@Component({
  selector: 'wf-flows',
  standalone: true,
  imports: [],
  template: `
    <section class="page">
      <header class="page-head">
        <h1>Fluxos</h1>
        <button
          class="wf-btn wf-btn--primary"
          data-cy="create-flow"
          (click)="createFlow()"
          [disabled]="creating()"
        >
          {{ creating() ? 'Criando...' : 'Novo fluxo' }}
        </button>
      </header>

      @if (error()) {
        <p class="error">{{ error() }}</p>
      }

      @if (loading()) {
        <p class="muted">Carregando...</p>
      } @else if (flows().length === 0) {
        <p class="muted">Nenhum fluxo ainda. Crie o primeiro acima.</p>
      } @else {
        <div class="grid">
          @for (flow of flows(); track flow.id) {
            <article class="card" data-cy="flow-card" (click)="open(flow)">
              <div class="card-top">
                <strong>{{ flow.name }}</strong>
                <span class="badge" [class]="'st-' + flow.status">{{ label(flow.status) }}</span>
              </div>
              <p class="desc">{{ flow.description || 'Sem descrição' }}</p>
              <p class="meta">{{ flow.nodesJson.length }} nó(s) · v{{ flow.version }}</p>
            </article>
          }
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
        cursor: pointer;
        transition: box-shadow 0.15s;
      }
      .card:hover {
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
      }
      .card-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.5rem;
      }
      .desc {
        opacity: 0.6;
        font-size: 0.85rem;
        margin: 0.5rem 0 0.4rem;
      }
      .meta {
        opacity: 0.5;
        font-size: 0.75rem;
      }
      .badge {
        font-size: 0.7rem;
        padding: 0.15rem 0.5rem;
        border-radius: 999px;
        background: #eee;
        white-space: nowrap;
      }
      .st-PUBLISHED {
        background: #d1fae5;
        color: #065f46;
      }
      .st-DRAFT {
        background: #fef3c7;
        color: #92400e;
      }
      .st-ARCHIVED {
        background: #e5e7eb;
        color: #374151;
      }
      .muted {
        opacity: 0.65;
      }
      .error {
        color: #b42318;
      }
    `,
  ],
})
export class FlowsComponent implements OnInit {
  private svc = inject(FlowsService);
  private router = inject(Router);

  flows = signal<Flow[]>([]);
  loading = signal(true);
  creating = signal(false);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  label(s: FlowStatus): string {
    return STATUS_LABEL[s] ?? s;
  }

  load(): void {
    this.loading.set(true);
    this.svc.list().subscribe({
      next: res => {
        this.flows.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Falha ao carregar fluxos');
        this.loading.set(false);
      },
    });
  }

  open(flow: Flow): void {
    void this.router.navigate(['/flows', flow.id]);
  }

  createFlow(): void {
    this.creating.set(true);
    this.error.set(null);
    this.svc
      .create({
        name: 'Novo fluxo',
        triggerType: 'KEYWORD',
        nodesJson: [],
        edgesJson: [],
      })
      .subscribe({
        next: flow => {
          this.creating.set(false);
          void this.router.navigate(['/flows', flow.id]);
        },
        error: (e: { error?: { message?: string } }) => {
          this.creating.set(false);
          this.error.set(e?.error?.message ?? 'Falha ao criar fluxo');
        },
      });
  }
}
