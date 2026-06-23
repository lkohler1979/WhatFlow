import { Routes } from '@angular/router';

export const CONTACTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./contacts.component').then(m => m.ContactsComponent),
  },
];
