import { computed, inject, Injectable, signal } from '@angular/core';
import { ProductService } from './product-service';

export enum ProductCategory {
  SilkDhoti = 'Silk Dhoti',
  PlainDhoti = 'Plain Dhoti',
  SilkDhotiSet = 'Silk Dhoti Set',
  PlainDhotiSet = 'Plain Dhoti Set',
  ComboSet = 'Combo Set',
  SilkShirt = 'Silk Shirt',
  PlainShirt = 'Plain Shirt',
  SilkMaterialCombo = 'Silk Material Combo',
}
  export enum SleeveLength {
    FullSleeve = 'Full Sleeve',
    HalfSleeve = 'Half Sleeve',
    ThreeQuarterSleeve = 'Three Quarter Sleeve',
  }
  export enum ShirtSize {
    Small = 'Small',
    Medium = 'Medium',
    Large = 'Large',
    ExtraLarge = 'Extra Large',
  }
  
  export enum DhotiSize {
    EightMulam = '8 Mulam',
    NineMulam = '9 Mulam',
    TenMulam = '10 Mulam',
  }
export interface CartItem {
  id: string;
  variantKey?: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  category?: ProductCategory;
  dhotiSize?: DhotiSize;
  sleeveLength?: SleeveLength; // Optional sleeve length for shirts
  shirtSize?: ShirtSize; // Optional shirt size for shirts
}

export interface Product extends Omit<CartItem, 'quantity' | 'category'> {
  description: string;
  category: ProductCategory;
  quantity?: number; // Optional quantity for display purposes
}


@Injectable({
  providedIn: 'root',
})
export class CartService {
  readonly cartItems = signal<CartItem[]>([]);
  readonly products = inject(ProductService).products;
  // Computed signal for total price
  readonly totalPrice = computed(() =>
    this.cartItems().reduce((sum, item) => sum + item.price * item.quantity, 0)
  );
  readonly itemCount = computed(() =>
    this.cartItems().reduce((sum, item) => sum + item.quantity, 0)
  );

  quantityFor(productId: string): number {
    return this.cartItems()
      .filter((item) => item.id === productId)
      .reduce((quantity, item) => quantity + item.quantity, 0);
  }

  increaseQuantity(productId: string): void {
    this.cartItems.update((items) => {
      const existingItem = items.find(
        (item) => item.variantKey === productId || (item.id === productId && !item.variantKey),
      );
      if (existingItem) {
        return items.map((item) =>
          item === existingItem ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }

      const product = this.products().find((item) => item.id === productId);
      return product ? [...items, { ...product, quantity: 1 }] : items;
    });
  }

  decreaseQuantity(productId: string): void {
    this.cartItems.update((items) =>
      items
        .map((item) =>
          item.variantKey === productId || (item.id === productId && !item.variantKey)
            ? { ...item, quantity: item.quantity - 1 }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  removeFromCart(productId: string): void {
    this.cartItems.update((items) =>
      items.filter(
        (item) => item.variantKey !== productId && !(item.id === productId && !item.variantKey),
      ),
    );
  }

  clear(): void {
    this.cartItems.set([]);
  }

  addToCart(product: Omit<CartItem, 'quantity' | 'variantKey'>, quantity = 1): void {
    const variantKey = this.variantKeyFor(product);
    this.cartItems.update((items) => {
      const existing = items.find((item) => this.variantKeyFor(item) === variantKey);
      if (existing) {
        return items.map((item) =>
          item === existing ? { ...item, quantity: item.quantity + quantity } : item,
        );
      }
      return [...items, { ...product, variantKey, quantity }];
    });
  }

  private variantKeyFor(
    product: Pick<CartItem, 'id' | 'dhotiSize' | 'shirtSize' | 'sleeveLength'>,
  ): string {
    return [
      product.id,
      product.dhotiSize ?? '',
      product.shirtSize ?? '',
      product.sleeveLength ?? '',
    ].join(':');
  }
}
