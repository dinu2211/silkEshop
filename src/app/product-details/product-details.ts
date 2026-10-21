import { CurrencyPipe } from '@angular/common';
import { Component, EventEmitter, HostListener, inject, Input, Output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import {
  CartService,
  DhotiSize,
  Product,
  ProductCategory,
  ShirtSize,
  SleeveLength,
} from '../cart-service';

const DHOTI_SIZE_CATEGORIES: ProductCategory[] = [
  ProductCategory.SilkDhoti,
  ProductCategory.PlainDhoti,
  ProductCategory.SilkDhotiSet,
  ProductCategory.PlainDhotiSet,
  ProductCategory.ComboSet,
  ProductCategory.SilkMaterialCombo,
];

const SHIRT_OPTION_CATEGORIES: ProductCategory[] = [
  ProductCategory.SilkDhotiSet,
  ProductCategory.PlainDhotiSet,
  ProductCategory.ComboSet,
  ProductCategory.SilkShirt,
  ProductCategory.PlainShirt,
  ProductCategory.SilkMaterialCombo,
];

@Component({
  selector: 'app-product-details',
  imports: [CurrencyPipe, MatIcon],
  templateUrl: './product-details.html',
  styleUrl: './product-details.scss',
})
export class ProductDetails {
  @Input({ required: true }) product!: Product;
  @Output() readonly close = new EventEmitter<void>();

  private readonly cartService = inject(CartService);

  readonly dhotiSizes = Object.values(DhotiSize);
  readonly shirtSizes = Object.values(ShirtSize);
  readonly sleeveLengths = Object.values(SleeveLength);

  dhotiSize = DhotiSize.EightMulam;
  shirtSize = ShirtSize.Medium;
  sleeveLength = SleeveLength.FullSleeve;
  quantity = 1;

  get showsDhotiSize(): boolean {
    return DHOTI_SIZE_CATEGORIES.includes(this.product.category);
  }

  get showsShirtOptions(): boolean {
    return SHIRT_OPTION_CATEGORIES.includes(this.product.category);
  }

  decreaseQuantity(): void {
    if (this.quantity > 1) {
      this.quantity -= 1;
    }
  }

  increaseQuantity(): void {
    this.quantity += 1;
  }

  addToCart(): void {
    this.cartService.addToCart(
      {
        ...this.product,
        ...(this.showsDhotiSize ? { dhotiSize: this.dhotiSize } : {}),
        ...(this.showsShirtOptions
          ? { shirtSize: this.shirtSize, sleeveLength: this.sleeveLength }
          : {}),
      },
      this.quantity,
    );
    this.close.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close.emit();
  }
}
