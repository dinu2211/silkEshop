import { Routes } from '@angular/router';

export const routes: Routes = [{
  path: '',
  pathMatch: 'full',
  loadComponent: () => import('./home/home').then(m => m.Home)
}, {
  path: 'checkout',
  loadComponent: () => import('./checkout/checkout').then(m => m.Checkout)
}];
