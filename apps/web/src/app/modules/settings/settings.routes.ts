import { Routes } from '@angular/router';

export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./settings.component').then(m => m.SettingsComponent),
  },
  {
    path: 'ai',
    loadComponent: () =>
      import('./components/ai-config/ai-config.component').then(m => m.AiConfigComponent),
  },
  {
    path: 'webhooks',
    loadComponent: () =>
      import('./components/webhook-list/webhook-list.component').then(m => m.WebhookListComponent),
  },
  {
    path: 'style-guide',
    loadComponent: () =>
      import('./components/style-guide/style-guide.component').then(m => m.StyleGuideComponent),
  },
];
