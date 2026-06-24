import { Routes } from '@angular/router';

export const INSTANCES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./instances.component').then(m => m.InstancesComponent),
  },
];
