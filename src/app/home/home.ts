import { afterNextRender, Component, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { RouterLink } from '@angular/router';
import { Search } from '../search/search';
import { CommonModule } from '@angular/common';
import { Product, ProductCategory, ProductCollection } from '../cart-service';
import { ProductDetails } from '../product-details/product-details';
import { Supabase } from '../services/supabase';

type ShopCategory = 'shirts' | 'dhotis' | 'silk-dhotis' | 'combo-offers';

@Component({
  selector: 'app-home',
  imports: [MatCardModule, Search, CommonModule, ProductDetails, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly supabase = inject(Supabase);

  readonly products = signal<Product[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly collections = Object.values(ProductCollection);
  readonly shopCategories: {
    id: ShopCategory;
    label: string;
    monogram: string;
  }[] = [
    { id: 'shirts', label: 'Shirts', monogram: 'S' },
    { id: 'dhotis', label: 'Dhoti', monogram: 'D' },
    { id: 'silk-dhotis', label: 'Silk Dhoti', monogram: 'SD' },
    { id: 'combo-offers', label: 'Combo Offers', monogram: 'C' },
  ];

  constructor() {
    afterNextRender(() => {
      void this.loadProducts();
    });
  }

  selectedCollection: ProductCollection | 'unassigned' | null = null;
  selectedShopCategory: ShopCategory | null = null;
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
    const shopCategory = this.selectedShopCategory;
    const categoryProducts = shopCategory
      ? products.filter((product) => this.matchesShopCategory(product, shopCategory))
      : products;

    if (this.selectedCollection === 'unassigned') {
      return categoryProducts.filter((product) => !product.collection);
    }

    return this.selectedCollection
      ? categoryProducts.filter((product) => product.collection === this.selectedCollection)
      : categoryProducts;
  }

  categoryImage(category: ShopCategory): string | null {
    return (
      this.availableProducts.find(
        (product) => this.matchesShopCategory(product, category) && product.imageUrls[0],
      )?.imageUrls[0] ?? null
    );
  }

  shopCategoryLabel(category: ShopCategory): string {
    return this.shopCategories.find((item) => item.id === category)?.label ?? category;
  }

  startingPrice(product: Product): number {
    const availablePrices = product.variantPrices
      .filter((variant) => variant.quantity > 0)
      .map((variant) => variant.price);
    return Math.min(...availablePrices);
  }

  selectCollection(collection: ProductCollection | 'unassigned' | null): void {
    this.selectedShopCategory = null;
    this.selectedCollection = collection;
  }

  selectShopCategory(category: ShopCategory): void {
    this.selectedCollection = null;
    this.selectedShopCategory = category;
  }

  scrollToProducts(event: MouseEvent, catalog: HTMLElement): void {
    event.preventDefault();
    catalog.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private matchesShopCategory(product: Product, category: ShopCategory): boolean {
    switch (category) {
      case 'shirts':
        return (
          product.category === ProductCategory.SilkShirt ||
          product.category === ProductCategory.PlainShirt
        );
      case 'dhotis':
        return (
          product.category === ProductCategory.PlainDhoti ||
          product.category === ProductCategory.PlainDhotiSet
        );
      case 'silk-dhotis':
        return (
          product.category === ProductCategory.SilkDhoti ||
          product.category === ProductCategory.SilkDhotiSet
        );
      case 'combo-offers':
        return (
          product.category === ProductCategory.SilkDhotiSet ||
          product.category === ProductCategory.PlainDhotiSet ||
          product.category === ProductCategory.ComboSet ||
          product.category === ProductCategory.SilkMaterialCombo
        );
    }
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
