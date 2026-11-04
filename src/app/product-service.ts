import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import type { Product } from './cart-service';
import { Supabase } from './services/supabase';

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  private readonly supabase = inject(Supabase);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly products = signal<Product[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    if (this.isBrowser) {
      this.loadProducts();
    }
  }

  async loadProducts(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      this.products.set(await this.supabase.getProducts());
    } catch (error: unknown) {
      console.error('Failed to load products from Supabase.', error);
      this.error.set('Unable to load products. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
