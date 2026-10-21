import { computed, Injectable, signal } from '@angular/core';

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
  readonly products = signal<Product[]>([
    {
      id: 'silk-dhoti-01',
      name: 'Kanchipuram Silk Dhoti - Gold Zari Border',
      description: 'Traditional cream silk dhoti with an elegant gold zari border.',
      price: 3499,
      imageUrl: 'assets/images/silk-dhoti-01.jpeg',
      category: ProductCategory.SilkDhoti,
    },
    {
      id: 'silk-dhoti-02',
      name: 'Pure Silk Dhoti - Maroon Border',
      description: 'Classic pure silk dhoti finished with a rich maroon border.',
      price: 3299,
      imageUrl: 'assets/images/silk-dhoti-02.jpeg',
      category: ProductCategory.SilkDhoti,
    },
    {
      id: 'silk-dhoti-03',
      name: 'Wedding Silk Dhoti - Wide Zari',
      description: 'Ceremonial silk dhoti featuring a wide traditional zari border.',
      price: 3999,
      imageUrl: 'assets/images/silk-dhoti-03.jpeg',
      category: ProductCategory.SilkDhoti,
    },
    {
      id: 'silk-dhoti-04',
      name: 'Soft Silk Dhoti - Green Border',
      description: 'Lightweight soft silk dhoti with a contrasting green border.',
      price: 2899,
      imageUrl: 'assets/images/silk-dhoti-04.jpeg',
      category: ProductCategory.SilkDhoti,
    },
    {
      id: 'silk-dhoti-05',
      name: 'Temple Border Silk Dhoti',
      description: 'Cream silk dhoti with a detailed temple-inspired zari border.',
      price: 3699,
      imageUrl: 'assets/images/silk-dhoti-05.jpeg',
      category: ProductCategory.SilkDhoti,
    },
    {
      id: 'silk-dhoti-06',
      name: 'Mysore Silk Dhoti - Gold Edge',
      description: 'Smooth Mysore-style silk dhoti with a subtle gold edge.',
      price: 3199,
      imageUrl: 'assets/images/silk-dhoti-06.jpeg',
      category: ProductCategory.SilkDhoti,
    },
    {
      id: 'silk-dhoti-07',
      name: 'Silk Dhoti - Royal Blue Border',
      description: 'Traditional silk dhoti with a striking royal blue border.',
      price: 3399,
      imageUrl: 'assets/images/silk-dhoti-07.jpeg',
      category: ProductCategory.SilkDhoti,
    },
    {
      id: 'silk-dhoti-08',
      name: 'Silk Dhoti - Red Zari Border',
      description: 'Festive cream silk dhoti trimmed with a red zari border.',
      price: 3599,
      imageUrl: 'assets/images/silk-dhoti-08.jpeg',
      category: ProductCategory.SilkDhoti,
    },
    {
      id: 'silk-dhoti-09',
      name: 'Lightweight Silk Dhoti - Beige Border',
      description: 'Comfortable lightweight silk dhoti with a refined beige border.',
      price: 2799,
      imageUrl: 'assets/images/silk-dhoti-09.jpeg',
      category: ProductCategory.SilkMaterialCombo,
    },
    {
      id: 'silk-dhoti-10',
      name: 'Silk Dhoti - Double Zari Border',
      description: 'Ceremonial silk dhoti with a distinctive double zari border.',
      price: 3799,
      imageUrl: 'assets/images/silk-dhoti-10.jpeg',
      category: ProductCategory.SilkDhotiSet,
    },
    {
      id: 'silk-dhoti-11',
      name: 'Traditional Silk Dhoti - Purple Border',
      description: 'Classic silk dhoti with a rich purple contrast border.',
      price: 3299,
      imageUrl: 'assets/images/silk-dhoti-11.jpeg',
      category: ProductCategory.SilkDhotiSet,
    },
    {
      id: 'silk-dhoti-12',
      name: 'Silk Dhoti - Checked Zari Border',
      description: 'Textured silk dhoti with a checked gold zari border.',
      price: 3499,
      imageUrl: 'assets/images/silk-dhoti-12.jpeg',
      category: ProductCategory.SilkDhotiSet,
    },
    {
      id: 'silk-dhoti-13',
      name: 'Premium Silk Dhoti - Grand Border',
      description: 'Premium silk dhoti designed with a broad grand zari border.',
      price: 4299,
      imageUrl: 'assets/images/silk-dhoti-13.jpeg',
      category: ProductCategory.SilkDhotiSet,
    },
    {
      id: 'silk-dhoti-14',
      name: 'Silk Dhoti - Orange Contrast Border',
      description: 'Festive silk dhoti with a bright orange contrast border.',
      price: 3099,
      imageUrl: 'assets/images/silk-dhoti-14.jpeg',
      category: ProductCategory.SilkDhotiSet,
    },
    {
      id: 'silk-dhoti-15',
      name: 'Silk Dhoti - Classic Gold Border',
      description: 'Versatile cream silk dhoti with a timeless gold border.',
      price: 2999,
      imageUrl: 'assets/images/silk-dhoti-15.jpeg',
      category: ProductCategory.SilkDhotiSet,
    },
    {
      id: 'plain-dhoti-01',
      name: 'Cotton Dhoti - White with Gold Border',
      description: 'Breathable white cotton dhoti with a simple gold-tone border.',
      price: 799,
      imageUrl: 'assets/images/silk-dhoti-16.jpeg',
      category: ProductCategory.SilkDhotiSet,
    },
    {
      id: 'plain-dhoti-02',
      name: 'Cotton Dhoti - White with Green Border',
      description: 'Everyday white cotton dhoti finished with a green border.',
      price: 749,
      imageUrl: 'assets/images/silk-dhoti-17.jpeg',
      category: ProductCategory.SilkDhotiSet,
    },
    {
      id: 'plain-dhoti-03',
      name: 'Traditional White Cotton Dhoti',
      description: 'Soft, breathable white cotton dhoti for daily traditional wear.',
      price: 699,
      imageUrl: 'assets/images/silk-dhoti-18.jpeg',
      category: ProductCategory.SilkDhotiSet,
    },
    {
      id: 'plain-dhoti-04',
      name: 'Cotton Dhoti - Maroon Border',
      description: 'Classic white cotton dhoti with a contrasting maroon border.',
      price: 799,
      imageUrl: 'assets/images/silk-dhoti-19.jpeg',
      category: ProductCategory.SilkDhotiSet,
    },
  ]
  );
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
