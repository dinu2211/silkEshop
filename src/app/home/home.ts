import { isPlatformBrowser } from '@angular/common';
import { Component, inject, PLATFORM_ID, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card'; 
import { Search } from '../search/search';
import { CommonModule } from '@angular/common';
import { Product } from '../cart-service';
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

  constructor() {
    if (this.isBrowser) {
      void this.loadProducts();
    }
  }

  selectedCategory: string | null = null;
  selectedProduct: Product | null = null;

  get categories(): string[] {
    return [...new Set(this.products().map((product) => product.category))];
  }

  get filteredProducts() {
    const products = this.products();
    return this.selectedCategory
      ? products.filter((product) => product.category === this.selectedCategory)
      : products;
  }

  selectCategory(category: string | null): void {
    this.selectedCategory = category;
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
