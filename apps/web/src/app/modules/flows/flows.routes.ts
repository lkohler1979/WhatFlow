import { Routes } from '@angular/router';

export const FLOWS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./flows.component').then(m => m.FlowsComponent),
  },
  {
    path: ':id',
    loadComponent: () => import('./flow-builder.component').then(m => m.FlowBuilderComponent),
  },
];
