import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarNavComponent } from '../shared/components/sidebar-nav/sidebar-nav.component';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'wf-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarNavComponent],
  template: `
    <div class="app-shell">
      <wf-sidebar-nav />
      <div class="app-main">
        <header class="app-header">
          <span class="brand">WhatFlow</span>
          <div class="user-box">
            @if (auth.user(); as u) {
              <span class="user-name">{{ u.fullName }}</span>
              <span class="user-role">{{ u.role }}</span>
            }
            <button type="button" class="logout" (click)="auth.logout()">Sair</button>
          </div>
        </header>
        <main class="app-content">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [
    `
      .app-shell {
        display: flex;
        height: 100vh;
        overflow: hidden;
      }
      .app-main {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .app-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 1.5rem;
        height: 56px;
        background: #fff;
        border-bottom: 1px solid #e5e7eb;
      }
      .brand {
        font-weight: 700;
        color: #1a5276;
      }
      .user-box {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      .user-name {
        font-weight: 600;
      }
      .user-role {
        font-size: 0.7rem;
        padding: 0.15rem 0.5rem;
        border-radius: 999px;
        background: #ebf5fb;
        color: #1a5276;
      }
      .logout {
        padding: 0.4rem 0.9rem;
        border: 1px solid #d0d5dd;
        border-radius: 8px;
        background: #fff;
        cursor: pointer;
        font-weight: 600;
      }
      .logout:hover {
        background: #f9fafb;
      }
      .app-content {
        flex: 1;
        overflow: auto;
      }
    `,
  ],
})
export class ShellComponent {
  auth = inject(AuthService);
}
