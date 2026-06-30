import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'wf-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-card">
      <h1>Recuperar senha</h1>
      <p class="hint">Informe seu e-mail para receber o link de redefinição de senha.</p>

      @if (sent()) {
        <p class="success">
          Se o e-mail estiver cadastrado, você receberá um link de recuperação em alguns minutos.
        </p>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()">
          <label>
            E-mail
            <input type="email" formControlName="email" autocomplete="email" />
          </label>

          @if (error()) {
            <p class="error">{{ error() }}</p>
          }

          <button type="submit" [disabled]="form.invalid || loading()">
            {{ loading() ? 'Enviando...' : 'Enviar link' }}
          </button>
        </form>
      }

      <p class="alt"><a routerLink="/auth/login">Voltar para o login</a></p>
    </div>
  `,
  styleUrl: './../../auth-shared.scss',
})
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);

  loading = signal(false);
  sent = signal(false);
  error = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  submit(): void {
    if (this.form.invalid) return;

    this.loading.set(true);
    this.error.set(null);
    this.auth.requestPasswordReset(this.form.getRawValue().email).subscribe({
      next: () => {
        this.sent.set(true);
        this.loading.set(false);
      },
      error: (e: { error?: { message?: string } }) => {
        this.error.set(e?.error?.message ?? 'Não foi possível enviar o link de recuperação.');
        this.loading.set(false);
      },
    });
  }
}
