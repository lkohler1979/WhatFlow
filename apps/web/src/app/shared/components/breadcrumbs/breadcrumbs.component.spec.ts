import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Component } from '@angular/core';
import { BreadcrumbsComponent } from './breadcrumbs.component';

@Component({ standalone: true, template: '' })
class BlankComponent {}

describe('BreadcrumbsComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BreadcrumbsComponent],
      providers: [
        provideRouter([
          { path: 'dashboard', component: BlankComponent },
          { path: 'contacts/:id', component: BlankComponent },
        ]),
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(BreadcrumbsComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should build a friendly crumb for a known segment', async () => {
    const harness = await RouterTestingHarness.create();
    const router = TestBed.inject(Router);
    await router.navigate(['/dashboard']);
    const fixture = TestBed.createComponent(BreadcrumbsComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.crumbs()).toEqual([{ label: 'Dashboard', url: '/dashboard' }]);
    harness.detectChanges();
  });

  it('should capitalize an unknown segment and build multiple crumbs', async () => {
    const router = TestBed.inject(Router);
    await router.navigate(['/contacts/abc']);
    const fixture = TestBed.createComponent(BreadcrumbsComponent);
    fixture.detectChanges();
    const crumbs = fixture.componentInstance.crumbs();
    expect(crumbs.length).toBe(2);
    expect(crumbs[0]).toEqual({ label: 'Contatos', url: '/contacts' });
    expect(crumbs[1]).toEqual({ label: 'Abc', url: '/contacts/abc' });
  });
});
