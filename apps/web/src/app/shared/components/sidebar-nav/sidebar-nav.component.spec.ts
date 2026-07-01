import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SidebarNavComponent } from './sidebar-nav.component';

describe('SidebarNavComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SidebarNavComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(SidebarNavComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should expose the expected nav items', () => {
    const fixture = TestBed.createComponent(SidebarNavComponent);
    const component = fixture.componentInstance;
    expect(component.navItems.length).toBe(7);
    expect(component.navItems.map(i => i.route)).toContain('/dashboard');
    expect(component.navItems.map(i => i.route)).toContain('/analytics');
  });

  it('should render a nav item link per route plus the static settings link', () => {
    const fixture = TestBed.createComponent(SidebarNavComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const links = compiled.querySelectorAll('a');
    // navItems (dynamic, via @for) + 1 static settings link.
    expect(links.length).toBe(fixture.componentInstance.navItems.length + 1);
  });
});
