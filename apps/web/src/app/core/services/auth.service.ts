import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
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
}
