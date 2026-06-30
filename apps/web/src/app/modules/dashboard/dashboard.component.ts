import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  AnalyticsService,
  Granularity,
  MessagesSeries,
  Overview,
} from '../analytics/analytics.service';
import { MessageVolumeChartComponent } from '../analytics/components/message-volume-chart/message-volume-chart.component';

interface Kpi {
  label: string;
  value: string;
  icon: string;
}

interface PeriodPreset {
  days: number;
  label: string;
  granularity: Granularity;
}

const PRESETS: PeriodPreset[] = [
  { days: 7, label: 'Últimos 7 dias', granularity: 'day' },
  { days: 30, label: 'Últimos 30 dias', granularity: 'day' },
  { days: 90, label: 'Últimos 90 dias', granularity: 'week' },
];

@Component({
  selector: 'wf-dashboard',
  standalone: true,
  imports: [MessageVolumeChartComponent],
  template: `
    <section class="dash">
      <header class="head">
        <div>
          <h1>Dashboard</h1>
          <p class="sub">Visão geral da sua conta — {{ activePreset().label.toLowerCase() }}.</p>
        </div>
        <div class="filter" role="group" aria-label="Filtro de período">
          @for (p of presets; track p.days) {
            <button
              type="button"
              class="chip"
              [class.active]="p.days === selectedDays()"
              (click)="selectPreset(p.days)"
            >
              {{ p.label }}
            </button>
          }
        </div>
      </header>

      @if (error()) {
        <p class="error">{{ error() }}</p>
      }

      <div class="kpi-grid">
        @for (kpi of kpis(); track kpi.label) {
          <article class="kpi-card" [class.skeleton]="loading()">
            <span class="kpi-icon">{{ kpi.icon }}</span>
            <div class="kpi-body">
              <span class="kpi-value">{{ loading() ? '…' : kpi.value }}</span>
              <span class="kpi-label">{{ kpi.label }}</span>
            </div>
          </article>
        }
      </div>

      <article class="chart-card">
        <h2>Volume de mensagens</h2>
        @if (loading()) {
          <p class="muted">Carregando gráfico…</p>
        } @else {
          <wf-message-volume-chart
            [points]="series()?.series ?? []"
            [granularity]="activePreset().granularity"
          />
        }
      </article>
    </section>
  `,
  styles: [
    `
      .dash {
        padding: 1.5rem 2rem;
      }
      .head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1rem;
        flex-wrap: wrap;
        margin-bottom: 1.5rem;
      }
      h1 {
        font-size: 1.6rem;
        margin-bottom: 0.25rem;
      }
      .sub {
        opacity: 0.7;
      }
      .filter {
        display: flex;
        gap: 0.4rem;
        flex-wrap: wrap;
      }
      .chip {
        border: 1px solid #d0d5dd;
        background: #fff;
        border-radius: 999px;
        padding: 0.4rem 0.9rem;
        font: inherit;
        font-size: 0.82rem;
        cursor: pointer;
        transition:
          background 0.15s,
          color 0.15s;
      }
      .chip:hover {
        background: #f3f4f6;
      }
      .chip.active {
        background: #1a5276;
        border-color: #1a5276;
        color: #fff;
      }
      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 1rem;
        margin-bottom: 1.5rem;
      }
      .kpi-card {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1.25rem;
        border-radius: 12px;
        background: #fff;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
      }
      .kpi-card.skeleton {
        opacity: 0.55;
      }
      .kpi-icon {
        font-size: 1.8rem;
        line-height: 1;
      }
      .kpi-body {
        display: flex;
        flex-direction: column;
      }
      .kpi-value {
        font-size: 1.6rem;
        font-weight: 700;
        color: #1a5276;
      }
      .kpi-label {
        font-size: 0.85rem;
        opacity: 0.7;
      }
      .chart-card {
        padding: 1.25rem 1.5rem;
        border-radius: 12px;
        background: #fff;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
      }
      .chart-card h2 {
        font-size: 1.05rem;
        margin-bottom: 0.75rem;
      }
      .muted {
        opacity: 0.65;
      }
      .error {
        color: #b42318;
        margin-bottom: 1rem;
      }
    `,
  ],
})
export class DashboardComponent implements OnInit {
  private analytics = inject(AnalyticsService);

  presets = PRESETS;
  selectedDays = signal(30);
  loading = signal(true);
  error = signal<string | null>(null);
  overview = signal<Overview | null>(null);
  series = signal<MessagesSeries | null>(null);

  activePreset = computed(() => PRESETS.find(p => p.days === this.selectedDays()) ?? PRESETS[1]);

  kpis = computed<Kpi[]>(() => {
    const o = this.overview();
    const connected = o?.instances.byStatus.CONNECTED ?? 0;
    return [
      { label: 'Mensagens', value: fmt(o?.messages.total), icon: '💬' },
      { label: 'Conversas', value: fmt(o?.conversations.total), icon: '📨' },
      { label: 'Contatos', value: fmt(o?.contacts.total), icon: '👥' },
      { label: 'Instâncias conectadas', value: fmt(connected), icon: '📱' },
      { label: 'Campanhas', value: fmt(o?.campaigns.total), icon: '📣' },
    ];
  });

  ngOnInit(): void {
    this.load();
  }

  selectPreset(days: number): void {
    if (days === this.selectedDays()) return;
    this.selectedDays.set(days);
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    const preset = this.activePreset();
    const now = new Date();
    const from = new Date(now.getTime() - preset.days * 24 * 60 * 60 * 1000);
    const query = {
      from: from.toISOString(),
      to: now.toISOString(),
      granularity: preset.granularity,
    };

    let pending = 2;
    const done = (): void => {
      if (--pending === 0) this.loading.set(false);
    };

    this.analytics.overview(query).subscribe({
      next: o => {
        this.overview.set(o);
        done();
      },
      error: () => {
        this.error.set('Falha ao carregar métricas.');
        done();
      },
    });

    this.analytics.messages(query).subscribe({
      next: s => {
        this.series.set(s);
        done();
      },
      error: () => {
        this.error.set('Falha ao carregar o gráfico de mensagens.');
        done();
      },
    });
  }
}

function fmt(n: number | undefined): string {
  return n == null ? '—' : new Intl.NumberFormat('pt-BR').format(n);
}
