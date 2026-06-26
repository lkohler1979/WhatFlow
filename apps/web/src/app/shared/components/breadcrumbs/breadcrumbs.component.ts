import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';

interface Crumb {
  label: string;
  url: string;
}

// Rótulos amigáveis por segmento de rota.
const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  inbox: 'Inbox',
  flows: 'Fluxos',
  campaigns: 'Campanhas',
  contacts: 'Contatos',
  instances: 'Instâncias',
  analytics: 'Analytics',
  settings: 'Configurações',
};

@Component({
  selector: 'wf-breadcrumbs',
  standalone: true,
  imports: [RouterLink],
  template: `
    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        @for (crumb of crumbs(); track crumb.url; let last = $last) {
          <li>
            @if (last) {
              <span class="current" aria-current="page">{{ crumb.label }}</span>
            } @else {
              <a [routerLink]="crumb.url">{{ crumb.label }}</a>
              <span class="sep" aria-hidden="true">/</span>
            }
          </li>
        }
      </ol>
    </nav>
  `,
  styleUrl: './breadcrumbs.component.scss',
})
export class BreadcrumbsComponent {
  private router = inject(Router);

  readonly crumbs = signal<Crumb[]>(this.build(this.router.url));

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => this.crumbs.set(this.build(e.urlAfterRedirects)));
  }

  private build(url: string): Crumb[] {
    const segments = url.split('?')[0].split('#')[0].split('/').filter(Boolean);

    const crumbs: Crumb[] = [];
    let path = '';
    for (const seg of segments) {
      path += `/${seg}`;
      crumbs.push({ label: this.labelFor(seg), url: path });
    }
    return crumbs;
  }

  private labelFor(segment: string): string {
    if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment];
    const decoded = decodeURIComponent(segment);
    return decoded.charAt(0).toUpperCase() + decoded.slice(1);
  }
}
