import { Component } from '@angular/core';

interface Kpi {
  label: string;
  value: string;
  icon: string;
}

@Component({
  selector: 'wf-dashboard',
  standalone: true,
  template: `
    <section class="dash">
      <h1>Dashboard</h1>
      <p class="sub">
        Visão geral da sua conta — métricas placeholder (dados reais chegam no Sprint 6).
      </p>

      <div class="kpi-grid">
        @for (kpi of kpis; track kpi.label) {
          <article class="kpi-card">
            <span class="kpi-icon">{{ kpi.icon }}</span>
            <div class="kpi-body">
              <span class="kpi-value">{{ kpi.value }}</span>
              <span class="kpi-label">{{ kpi.label }}</span>
            </div>
          </article>
        }
      </div>
    </section>
  `,
  styles: [
    `
      .dash {
        padding: 1.5rem 2rem;
      }
      h1 {
        font-size: 1.6rem;
        margin-bottom: 0.25rem;
      }
      .sub {
        opacity: 0.7;
        margin-bottom: 1.5rem;
      }
      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 1rem;
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
    `,
  ],
})
export class DashboardComponent {
  kpis: Kpi[] = [
    { label: 'Mensagens (24h)', value: '—', icon: '💬' },
    { label: 'Conversas abertas', value: '—', icon: '📨' },
    { label: 'Contatos', value: '—', icon: '👥' },
    { label: 'Instâncias conectadas', value: '0', icon: '📱' },
  ];
}
