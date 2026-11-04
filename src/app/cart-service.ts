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

export const DHOTI_OPTION_CATEGORIES: readonly ProductCategory[] = [
  ProductCategory.SilkDhoti,
  ProductCategory.PlainDhoti,
  ProductCategory.SilkDhotiSet,
  ProductCategory.PlainDhotiSet,
  ProductCategory.ComboSet,
  ProductCategory.SilkMaterialCombo,
];

export const SHIRT_OPTION_CATEGORIES: readonly ProductCategory[] = [
  ProductCategory.SilkDhotiSet,
  ProductCategory.PlainDhotiSet,
  ProductCategory.ComboSet,
  ProductCategory.SilkShirt,
  ProductCategory.PlainShirt,
  ProductCategory.SilkMaterialCombo,
];

export enum ProductCollection {
  Function = 'Function',
  Wedding = 'Wedding',
  PartyWear = 'Party Wear',
  Engagement = 'Engagement',
  SummerSpecial = 'Summer Special',
  ArtSilk = 'Art Silk',
  SetDress = 'Set Dress',
  TissueCollection = 'Tissue Collection',
  RoyalTissue = 'Royal Tissue',
  SilkCollection = 'Silk Collection',
}

export enum ProductIdealFor {
  Kid = 'Kid',
  Men = 'Men',
  DadSonCombo = 'Dad & Son Combo',
}

export enum DhotiType {
  WithVelcroPocket = 'With Velcro Pocket',
  WithoutVelcroPocket = 'Without Velcro Pocket',
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

export interface ProductVariantPrice {
  dhotiSize?: DhotiSize;
  shirtSize?: ShirtSize;
  sleeveLength?: SleeveLength;
  dhotiType?: DhotiType;
  price: number;
  quantity: number;
}

export interface CartItem {
  id: string;
  variantKey?: string;
  name: string;
  price: number;
  quantity: number;
  stockQuantity?: number;
  imageUrl?: string;
  category?: ProductCategory;
  collection?: ProductCollection | null;
  idealFor?: ProductIdealFor | null;
  dhotiSize?: DhotiSize;
  dhotiType?: DhotiType;
  sleeveLength?: SleeveLength;
  shirtSize?: ShirtSize;
}

export interface Product extends Omit<CartItem, 'quantity' | 'category' | 'price' | 'stockQuantity'> {
  description: string;
  category: ProductCategory;
  variantPrices: ProductVariantPrice[];
  imageUrls: string[];
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

  quantityForVariant(
    product: Pick<CartItem, 'id' | 'dhotiSize' | 'shirtSize' | 'sleeveLength' | 'dhotiType'>,
  ): number {
    const variantKey = this.variantKeyFor(product);
    return this.cartItems()
      .filter((item) => this.variantKeyFor(item) === variantKey)
      .reduce((quantity, item) => quantity + item.quantity, 0);
  }

  increaseQuantity(productId: string): void {
    this.cartItems.update((items) => {
      const existingItem = items.find(
        (item) => item.variantKey === productId || (item.id === productId && !item.variantKey),
      );
      if (existingItem) {
        if (
          existingItem.stockQuantity !== undefined &&
          existingItem.quantity >= existingItem.stockQuantity
        ) {
          return items;
        }
        return items.map((item) =>
          item === existingItem ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }

      const product = this.products().find((item) => item.id === productId);
      const variant = product?.variantPrices?.find((item) => item.quantity > 0);
      return product && variant
        ? [
            ...items,
            {
              id: product.id,
              name: product.name,
              price: variant.price,
              quantity: 1,
              stockQuantity: variant.quantity,
              imageUrl: product.imageUrls[0] ?? product.imageUrl,
              category: product.category,
              collection: product.collection,
              idealFor: product.idealFor,
              dhotiSize: variant.dhotiSize,
              dhotiType: variant.dhotiType,
              shirtSize: variant.shirtSize,
              sleeveLength: variant.sleeveLength,
            },
          ]
        : items;
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
        const nextQuantity = existing.quantity + quantity;
        const maxQuantity = product.stockQuantity ?? Number.POSITIVE_INFINITY;
        return items.map((item) =>
          item === existing
            ? {
                ...item,
                ...product,
                quantity: Math.min(nextQuantity, maxQuantity),
              }
            : item,
        );
      }
      const maxQuantity = product.stockQuantity ?? Number.POSITIVE_INFINITY;
      const availableQuantity = Math.min(quantity, maxQuantity);
      return availableQuantity > 0
        ? [...items, { ...product, variantKey, quantity: availableQuantity }]
        : items;
    });
  }

  private variantKeyFor(
    product: Pick<CartItem, 'id' | 'dhotiSize' | 'shirtSize' | 'sleeveLength' | 'dhotiType'>,
  ): string {
    return [
      product.id,
      product.dhotiSize ?? '',
      product.shirtSize ?? '',
      product.sleeveLength ?? '',
      product.dhotiType ?? '',
    ].join(':');
  }
}
