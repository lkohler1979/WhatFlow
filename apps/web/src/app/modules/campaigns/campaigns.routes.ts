import { Routes } from '@angular/router';

export const CAMPAIGNS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./campaigns.component').then(m => m.CampaignsComponent),
  },
];
