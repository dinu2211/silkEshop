import { afterNextRender, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import type { Product } from '../cart-service';
import { ProductDetails } from '../product-details/product-details';
import { Supabase } from '../services/supabase';

@Component({
  selector: 'app-premium-collection',
  imports: [CommonModule, MatCardModule, ProductDetails],
  templateUrl: './premium-collection.html',
  styleUrl: './premium-collection.scss',
})
export class PremiumCollection {
  private readonly supabase = inject(Supabase);

  readonly products = signal<Product[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  selectedProduct: Product | null = null;

  constructor() {
    afterNextRender(() => {
      void this.loadProducts();
    });
  }

  get premiumProducts(): Product[] {
    return this.products().filter((product) => product.isPremium === true);
  }

  startingPrice(product: Product): number {
    const availablePrices = product.variantPrices
      .filter((variant) => variant.quantity > 0)
      .map((variant) => variant.price);
    const prices = availablePrices.length
      ? availablePrices
      : product.variantPrices.map((variant) => variant.price);
    return Math.min(...prices);
  }

  openProductDetails(product: Product): void {
    this.selectedProduct = product;
  }

  closeProductDetails(): void {
    this.selectedProduct = null;
  }

  async loadProducts(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      this.products.set(await this.supabase.getProducts());
    } catch (error: unknown) {
      console.error('Failed to load premium products from Supabase.', error);
      this.error.set('Unable to load the premium collection. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
