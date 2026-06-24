import { Component } from '@angular/core';

@Component({
  selector: 'wf-inbox',
  standalone: true,
  template: `
    <section class="page-placeholder">
      <h1>Inbox</h1>
      <p>Módulo em construção — Sprint futuro.</p>
    </section>
  `,
  styles: [
    `
      .page-placeholder {
        padding: 2rem;
      }
      h1 {
        font-size: 1.5rem;
        margin-bottom: 0.5rem;
      }
      p {
        opacity: 0.7;
      }
    `,
  ],
})
export class InboxComponent {}
