import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '@env/environment';

export type UserRole = 'OWNER' | 'ADMIN' | 'AGENT' | 'VIEWER';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  tenantId: string;
}

interface Session {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface AuthResponse {
  user: AuthUser;
  session: Session;
}

const TOKEN_KEY = 'wf_access_token';
const REFRESH_KEY = 'wf_refresh_token';
const USER_KEY = 'wf_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private supabase: SupabaseClient | null = null;

  private _user = signal<AuthUser | null>(null);
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => !!this._user() && !!this.getToken());

  constructor() {
    this.loadFromStorage();
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/login`, { email, password })
      .pipe(tap(res => this.persist(res)));
  }

  register(payload: {
    email: string;
    password: string;
    fullName: string;
    companyName: string;
  }): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/register`, payload)
      .pipe(tap(res => this.persist(res)));
  }

  requestPasswordReset(email: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/auth/forgot-password`, { email });
  }

  async completePasswordReset(password: string): Promise<void> {
    const supabase = this.getSupabaseClient();
    await this.consumeRecoverySession(supabase);

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      throw new Error(error.message || 'Não foi possível atualizar a senha.');
    }

    await supabase.auth.signOut();
  }

  logout(): void {
    this.http.post(`${environment.apiUrl}/auth/logout`, {}).subscribe({ error: () => undefined });
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    this._user.set(null);
    void this.router.navigate(['/auth/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private persist(res: AuthResponse): void {
    localStorage.setItem(TOKEN_KEY, res.session.accessToken);
    localStorage.setItem(REFRESH_KEY, res.session.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    this._user.set(res.user);
  }

  private loadFromStorage(): void {
    const raw = localStorage.getItem(USER_KEY);
    if (raw && this.getToken()) {
      try {
        this._user.set(JSON.parse(raw) as AuthUser);
      } catch {
        this.logout();
      }
    }
  }

  private getSupabaseClient(): SupabaseClient {
    if (this.supabase) return this.supabase;
    if (
      !environment.supabaseUrl ||
      !environment.supabaseAnonKey ||
      environment.supabaseUrl.includes('${') ||
      environment.supabaseAnonKey.includes('${')
    ) {
      throw new Error('Supabase público não configurado no frontend.');
    }

    this.supabase = createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
        flowType: 'pkce',
      },
    });
    return this.supabase;
  }

  private async consumeRecoverySession(supabase: SupabaseClient): Promise<void> {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw new Error(error.message || 'Link de recuperação inválido ou expirado.');
      this.clearRecoveryUrl(url.pathname);
      return;
    }

    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const accessToken = fragment.get('access_token');
    const refreshToken = fragment.get('refresh_token');

    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) throw new Error(error.message || 'Link de recuperação inválido ou expirado.');
      this.clearRecoveryUrl(url.pathname);
      return;
    }

    throw new Error('Link de recuperação inválido ou expirado.');
  }

  private clearRecoveryUrl(pathname: string): void {
    window.history.replaceState(null, document.title, pathname);
  }
}
