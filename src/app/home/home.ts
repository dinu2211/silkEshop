import { Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card'; 
import { Search } from '../search/search';
import { CommonModule } from '@angular/common';
import { CartService, Product } from '../cart-service';
import { ProductDetails } from '../product-details/product-details';

@Component({
  selector: 'app-home',
  imports: [MatCardModule, Search, CommonModule, ProductDetails],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  readonly cartService = inject(CartService);
  readonly products = this.cartService.products;

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
}
