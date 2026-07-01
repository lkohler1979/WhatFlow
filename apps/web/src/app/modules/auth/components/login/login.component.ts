import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'wf-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-card">
      <h1>Entrar no WhatFlow</h1>
      <form [formGroup]="form" (ngSubmit)="submit()">
        <label>
          E-mail
          <input type="email" formControlName="email" autocomplete="email" data-cy="login-email" />
        </label>
        <label>
          Senha
          <input
            type="password"
            formControlName="password"
            autocomplete="current-password"
            data-cy="login-password"
          />
        </label>

        @if (error()) {
          <p class="error" data-cy="login-error">{{ error() }}</p>
        }

        <button type="submit" [disabled]="form.invalid || loading()" data-cy="login-submit">
          {{ loading() ? 'Entrando...' : 'Entrar' }}
        </button>
      </form>
      <p class="alt">Não tem conta? <a routerLink="/auth/register">Criar conta</a></p>
      <p class="alt"><a routerLink="/auth/forgot-password">Esqueci minha senha</a></p>
    </div>
  `,
  styleUrl: './../../auth-shared.scss',
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  error = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (e: { error?: { message?: string } }) => {
        this.error.set(e?.error?.message ?? 'Falha no login. Verifique suas credenciais.');
        this.loading.set(false);
      },
    });
  }
}
