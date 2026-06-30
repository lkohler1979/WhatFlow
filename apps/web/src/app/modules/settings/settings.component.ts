import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'wf-settings',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="page-placeholder">
      <h1>Configurações</h1>
      <nav class="settings-nav">
        <a routerLink="ai" class="wf-btn wf-btn--primary">Configuração de IA</a>
        <a routerLink="webhooks" class="wf-btn wf-btn--primary">Webhooks</a>
      </nav>
    </section>
  `,
  styles: [
    `
      .page-placeholder {
        padding: 2rem;
      }
      h1 {
        font-size: 1.5rem;
        margin-bottom: 1rem;
      }
      .settings-nav {
        display: flex;
        gap: 0.75rem;
      }
    `,
  ],
})
export class SettingsComponent {}
