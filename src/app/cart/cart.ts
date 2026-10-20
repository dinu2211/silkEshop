import { Injectable, computed, signal } from '@angular/core';

export interface CartProduct {
  id: string;
  name: string;
  description: string;
  price: number;
}

export interface CartItem {
  product: CartProduct;
  quantity: number;
}

@Injectable({ providedIn: 'root' })
export class Cart {
  readonly items = signal<CartItem[]>([]);
  readonly itemCount = computed(() =>
    this.items().reduce((count, item) => count + item.quantity, 0),
  );

  add(product: CartProduct): void {
    this.items.update((items) => {
      const existingItem = items.find((item) => item.product.id === product.id);

      if (existingItem) {
        return items.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }

      return [...items, { product, quantity: 1 }];
    });
  }
}
