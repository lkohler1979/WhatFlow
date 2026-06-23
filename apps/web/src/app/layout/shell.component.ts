import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarNavComponent } from '../shared/components/sidebar-nav/sidebar-nav.component';

@Component({
  selector: 'wf-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarNavComponent],
  template: `
    <div class="app-shell">
      <wf-sidebar-nav />
      <main class="app-content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [
    `
      .app-shell {
        display: flex;
        height: 100vh;
        overflow: hidden;
      }
      .app-content {
        flex: 1;
        overflow: auto;
        display: flex;
        flex-direction: column;
      }
    `,
  ],
})
export class ShellComponent {}
