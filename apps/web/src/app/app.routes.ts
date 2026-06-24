import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./modules/auth/auth.routes').then(m => m.AUTH_ROUTES),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell.component').then(m => m.ShellComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./modules/dashboard/dashboard.routes').then(m => m.DASHBOARD_ROUTES),
      },
      {
        path: 'inbox',
        loadChildren: () => import('./modules/inbox/inbox.routes').then(m => m.INBOX_ROUTES),
      },
      {
        path: 'flows',
        loadChildren: () => import('./modules/flows/flows.routes').then(m => m.FLOWS_ROUTES),
      },
      {
        path: 'campaigns',
        loadChildren: () =>
          import('./modules/campaigns/campaigns.routes').then(m => m.CAMPAIGNS_ROUTES),
      },
      {
        path: 'contacts',
        loadChildren: () =>
          import('./modules/contacts/contacts.routes').then(m => m.CONTACTS_ROUTES),
      },
      {
        path: 'instances',
        loadChildren: () =>
          import('./modules/instances/instances.routes').then(m => m.INSTANCES_ROUTES),
      },
      {
        path: 'analytics',
        loadChildren: () =>
          import('./modules/analytics/analytics.routes').then(m => m.ANALYTICS_ROUTES),
      },
      {
        path: 'settings',
        loadChildren: () =>
          import('./modules/settings/settings.routes').then(m => m.SETTINGS_ROUTES),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
