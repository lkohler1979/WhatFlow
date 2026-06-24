import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'wf-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-card">
      <h1>Criar conta</h1>
      <form [formGroup]="form" (ngSubmit)="submit()">
        <label>
          Nome completo
          <input type="text" formControlName="fullName" autocomplete="name" />
        </label>
        <label>
          Nome da empresa
          <input type="text" formControlName="companyName" autocomplete="organization" />
        </label>
        <label>
          E-mail
          <input type="email" formControlName="email" autocomplete="email" />
        </label>
        <label>
          Senha (mín. 8 caracteres)
          <input type="password" formControlName="password" autocomplete="new-password" />
        </label>

        @if (error()) {
          <p class="error">{{ error() }}</p>
        }

        <button type="submit" [disabled]="form.invalid || loading()">
          {{ loading() ? 'Criando...' : 'Criar conta' }}
        </button>
      </form>
      <p class="alt">Já tem conta? <a routerLink="/auth/login">Entrar</a></p>
    </div>
  `,
  styleUrl: './../../auth-shared.scss',
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  error = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    companyName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    this.auth.register(this.form.getRawValue()).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (e: { error?: { message?: string } }) => {
        this.error.set(e?.error?.message ?? 'Falha ao criar conta.');
        this.loading.set(false);
      },
    });
  }
}
