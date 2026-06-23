import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, map } from 'rxjs';
import { environment } from '@env/environment';

export interface User {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  role: 'OWNER' | 'ADMIN' | 'AGENT' | 'VIEWER';
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: 'FREE' | 'PRO' | 'ENTERPRISE';
}

const TOKEN_KEY = 'wf_access_token';
const REFRESH_KEY = 'wf_refresh_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _user = signal<User | null>(null);
  private _tenant = signal<Tenant | null>(null);

  readonly user = this._user.asReadonly();
  readonly tenant = this._tenant.asReadonly();
  readonly isAuthenticated$ = new Observable<boolean>(obs => {
    obs.next(!!this.getToken());
  });

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {
    this.loadFromStorage();
  }

  login(email: string, password: string) {
    return this.http
      .post<{
        user: User;
        tenant: Tenant;
        accessToken: string;
        refreshToken: string;
      }>(`${environment.apiUrl}/auth/login`, { email, password })
      .pipe(
        tap(res => {
          localStorage.setItem(TOKEN_KEY, res.accessToken);
          localStorage.setItem(REFRESH_KEY, res.refreshToken);
          this._user.set(res.user);
          this._tenant.set(res.tenant);
        }),
      );
  }

  register(payload: { email: string; password: string; fullName: string; companyName: string }) {
    return this.http
      .post<{
        user: User;
        tenant: Tenant;
        accessToken: string;
        refreshToken: string;
      }>(`${environment.apiUrl}/auth/register`, payload)
      .pipe(
        tap(res => {
          localStorage.setItem(TOKEN_KEY, res.accessToken);
          localStorage.setItem(REFRESH_KEY, res.refreshToken);
          this._user.set(res.user);
          this._tenant.set(res.tenant);
        }),
      );
  }

  logout() {
    this.http.post(`${environment.apiUrl}/auth/logout`, {}).subscribe();
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    this._user.set(null);
    this._tenant.set(null);
    this.router.navigate(['/auth/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private loadFromStorage() {
    const token = this.getToken();
    if (token) {
      this.http.get<{ user: User; tenant: Tenant }>(`${environment.apiUrl}/auth/me`).subscribe({
        next: res => {
          this._user.set(res.user);
          this._tenant.set(res.tenant);
        },
        error: () => this.logout(),
      });
    }
  }
}
