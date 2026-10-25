import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import type { Product } from './cart-service';

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly products = signal<Product[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    if (this.isBrowser) {
      this.loadProducts();
    }
  }

  loadProducts(): void {
    this.loading.set(true);
    this.error.set(null);

    this.http.get<Product[]>('/api/products').subscribe({
      next: (products) => {
        this.products.set(products);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        console.error('Failed to load products from /api/products.', error);
        this.error.set('Unable to load products. Please try again.');
        this.loading.set(false);
      },
    });
  }
}
