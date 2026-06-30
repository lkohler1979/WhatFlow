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
];
