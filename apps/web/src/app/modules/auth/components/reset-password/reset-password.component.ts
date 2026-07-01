import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'wf-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-card">
      <h1>Nova senha</h1>

      @if (success()) {
        <p class="success">Senha atualizada. Você já pode entrar usando a nova senha.</p>
        <p class="alt"><a routerLink="/auth/login">Ir para o login</a></p>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()">
          <label>
            Nova senha
            <input type="password" formControlName="password" autocomplete="new-password" />
          </label>
          <label>
            Confirmar senha
            <input type="password" formControlName="confirmPassword" autocomplete="new-password" />
          </label>

          @if (error()) {
            <p class="error">{{ error() }}</p>
          }

          <button type="submit" [disabled]="form.invalid || loading()">
            {{ loading() ? 'Salvando...' : 'Salvar nova senha' }}
          </button>
        </form>
        <p class="alt"><a routerLink="/auth/login">Voltar para o login</a></p>
      }
    </div>
  `,
  styleUrl: './../../auth-shared.scss',
})
export class ResetPasswordComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);

  loading = signal(false);
  success = signal(false);
  error = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]],
  });

  async submit(): Promise<void> {
    if (this.form.invalid) return;

    const { password, confirmPassword } = this.form.getRawValue();
    if (password !== confirmPassword) {
      this.error.set('As senhas não conferem.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    try {
      await this.auth.completePasswordReset(password);
      this.success.set(true);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Não foi possível atualizar a senha.');
    } finally {
      this.loading.set(false);
    }
  }
}
