import { Routes } from '@angular/router';

export const routes: Routes = [{
  path: '',
  pathMatch: 'full',
  loadComponent: () => import('./home/home').then(m => m.Home)
}, {
  path: 'about',
  loadComponent: () => import('./about/about').then(m => m.About)
}, {
  path: 'contact',
  loadComponent: () => import('./contact/contact').then(m => m.Contact)
}, {
  path: 'track',
  loadComponent: () => import('./track/track').then(m => m.Track)
}, {
  path: 'view-order',
  loadComponent: () => import('./view-order/view-order').then(m => m.ViewOrder)
}, {
  path: 'manage-products',
  loadComponent: () => import('./manage-products/manage-products').then(m => m.ManageProducts)
}, {
  path: 'manage-promo',
  loadComponent: () => import('./manage-promo/manage-promo').then(m => m.ManagePromo)
}, {
  path: 'checkout',
  loadComponent: () => import('./checkout/checkout').then(m => m.Checkout)
}, {
  path: 'confirmation/:orderId',
  loadComponent: () => import('./conformation/conformation').then(m => m.Conformation)
}];
