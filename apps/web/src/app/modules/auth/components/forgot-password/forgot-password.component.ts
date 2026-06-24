import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'wf-forgot-password',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="auth-card">
      <h1>Recuperar senha</h1>
      <p>A recuperação de senha por e-mail será habilitada em breve (via Supabase Auth).</p>
      <p class="alt"><a routerLink="/auth/login">Voltar para o login</a></p>
    </div>
  `,
  styleUrl: './../../auth-shared.scss',
})
export class ForgotPasswordComponent {}
