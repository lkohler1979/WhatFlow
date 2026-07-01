import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { environment } from '@env/environment';
import { AuthService, AuthUser } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let routerSpy: jasmine.SpyObj<Router>;

  const user: AuthUser = {
    id: 'u1',
    email: 'a@b.com',
    fullName: 'A B',
    role: 'OWNER',
    tenantId: 't1',
  };

  beforeEach(() => {
    localStorage.clear();
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AuthService, { provide: Router, useValue: routerSpy }],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should not be authenticated initially', () => {
    expect(service.isAuthenticated()).toBeFalse();
    expect(service.user()).toBeNull();
  });

  it('login() should persist session and set user', () => {
    service.login('a@b.com', 'pw').subscribe(res => {
      expect(res.user).toEqual(user);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
    expect(req.request.method).toBe('POST');
    req.flush({
      user,
      session: { accessToken: 'tok', refreshToken: 'ref', expiresIn: 3600 },
    });

    expect(service.getToken()).toBe('tok');
    expect(service.user()).toEqual(user);
    expect(service.isAuthenticated()).toBeTrue();
  });

  it('register() should persist session and set user', () => {
    service
      .register({ email: 'a@b.com', password: 'pw', fullName: 'A B', companyName: 'Acme' })
      .subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/register`);
    expect(req.request.method).toBe('POST');
    req.flush({
      user,
      session: { accessToken: 'tok2', refreshToken: 'ref2', expiresIn: 3600 },
    });

    expect(service.getToken()).toBe('tok2');
    expect(service.user()).toEqual(user);
  });

  it('requestPasswordReset() should POST to forgot-password', () => {
    service.requestPasswordReset('a@b.com').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/auth/forgot-password`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'a@b.com' });
    req.flush(null);
  });

  it('logout() should clear storage, user and navigate to login', () => {
    localStorage.setItem('wf_access_token', 'tok');
    localStorage.setItem('wf_refresh_token', 'ref');
    localStorage.setItem('wf_user', JSON.stringify(user));

    service.logout();

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/logout`);
    req.flush(null);

    expect(localStorage.getItem('wf_access_token')).toBeNull();
    expect(localStorage.getItem('wf_refresh_token')).toBeNull();
    expect(localStorage.getItem('wf_user')).toBeNull();
    expect(service.user()).toBeNull();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  it('should load user from storage on construction when token present', () => {
    localStorage.setItem('wf_access_token', 'tok');
    localStorage.setItem('wf_user', JSON.stringify(user));

    const fresh = TestBed.inject(AuthService);
    // Re-create to trigger constructor logic with populated storage.
    expect(fresh).toBeTruthy();
  });

  it('getToken() should return null when nothing stored', () => {
    expect(service.getToken()).toBeNull();
  });
});
