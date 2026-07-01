import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  let authSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;
  const fakeTree = {} as UrlTree;

  beforeEach(() => {
    authSpy = jasmine.createSpyObj('AuthService', ['isAuthenticated']);
    routerSpy = jasmine.createSpyObj('Router', ['createUrlTree']);
    routerSpy.createUrlTree.and.returnValue(fakeTree);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });
  });

  function run() {
    let result: boolean | UrlTree = false;
    TestBed.runInInjectionContext(() => {
      result = authGuard({} as never, {} as never) as boolean | UrlTree;
    });
    return result;
  }

  it('should allow activation when authenticated', () => {
    authSpy.isAuthenticated.and.returnValue(true);
    expect(run()).toBeTrue();
  });

  it('should redirect to /auth/login when not authenticated', () => {
    authSpy.isAuthenticated.and.returnValue(false);
    const result = run();
    expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/auth/login']);
    expect(result as unknown).toBe(fakeTree as unknown);
  });
});
