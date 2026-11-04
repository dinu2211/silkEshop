import { isPlatformBrowser } from '@angular/common';
import { Component, inject, PLATFORM_ID, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card'; 
import { Search } from '../search/search';
import { CommonModule } from '@angular/common';
import { Product, ProductCollection } from '../cart-service';
import { ProductDetails } from '../product-details/product-details';
import { Supabase } from '../services/supabase';

@Component({
  selector: 'app-home',
  imports: [MatCardModule, Search, CommonModule, ProductDetails],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly supabase = inject(Supabase);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly products = signal<Product[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly collections = Object.values(ProductCollection);

  constructor() {
    if (this.isBrowser) {
      void this.loadProducts();
    }
  }

  selectedCollection: ProductCollection | 'unassigned' | null = null;
  selectedProduct: Product | null = null;

  get hasUnassignedProducts(): boolean {
    return this.availableProducts.some((product) => !product.collection);
  }

  get availableProducts(): Product[] {
    return this.products().filter((product) =>
      product.variantPrices.some((variant) => variant.quantity > 0),
    );
  }

  get filteredProducts() {
    const products = this.availableProducts;
    if (this.selectedCollection === 'unassigned') {
      return products.filter((product) => !product.collection);
    }

    return this.selectedCollection
      ? products.filter((product) => product.collection === this.selectedCollection)
      : products;
  }

  startingPrice(product: Product): number {
    const availablePrices = product.variantPrices
      .filter((variant) => variant.quantity > 0)
      .map((variant) => variant.price);
    return Math.min(...availablePrices);
  }

  selectCollection(collection: ProductCollection | 'unassigned' | null): void {
    this.selectedCollection = collection;
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
      console.error('Failed to load products from Supabase.', error);
      this.error.set('Unable to load products. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
