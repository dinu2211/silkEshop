import { TestBed } from '@angular/core/testing';

import { CartService, DhotiSize, Product, ProductCategory } from './cart-service';
import { ProductService } from './product-service';
import { Supabase } from './services/supabase';

describe('CartService', () => {
  let service: CartService;
  const products: Product[] = [
    {
      id: 'silk-dhoti-01',
      name: 'Kanchipuram Silk Dhoti - Gold Zari Border',
      description: 'Traditional cream silk dhoti with an elegant gold zari border.',
      imageUrls: ['assets/images/silk-dhoti-01.jpeg'],
      category: ProductCategory.SilkDhoti,
      variantPrices: [{ price: 3499, quantity: 5 }],
    },
  ];

  beforeEach(async () => {
    const supabase = jasmine.createSpyObj<Supabase>('Supabase', ['getProducts']);
    supabase.getProducts.and.resolveTo(products);

    TestBed.configureTestingModule({
      providers: [{ provide: Supabase, useValue: supabase }],
    });
    service = TestBed.inject(CartService);
    await TestBed.inject(ProductService).loadProducts();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('uses products returned by Supabase', () => {
    expect(service.products()).toEqual(products);
  });

  it('updates the displayed quantity when a product is increased or decreased', () => {
    const productId = service.products()[0].id;

    expect(service.quantityFor(productId)).toBe(0);

    service.increaseQuantity(productId);
    expect(service.quantityFor(productId)).toBe(1);

    service.increaseQuantity(productId);
    expect(service.quantityFor(productId)).toBe(2);

    service.decreaseQuantity(productId);
    expect(service.quantityFor(productId)).toBe(1);

    service.decreaseQuantity(productId);
    expect(service.quantityFor(productId)).toBe(0);
  });

  it('keeps differently sized product variants separate in the cart', () => {
    const product = service.products()[0];

    const cartProduct = { ...product, price: 3499 };
    service.addToCart({ ...cartProduct, dhotiSize: DhotiSize.EightMulam }, 2);
    service.addToCart({ ...cartProduct, dhotiSize: DhotiSize.TenMulam });

    expect(service.cartItems()).toHaveSize(2);
    expect(service.quantityFor(product.id)).toBe(3);

    const largerSize = service.cartItems()[1];
    service.increaseQuantity(largerSize.variantKey!);
    expect(service.cartItems()[1].quantity).toBe(2);

    service.decreaseQuantity(largerSize.variantKey!);
    expect(service.cartItems()[1].quantity).toBe(1);

    service.removeFromCart(largerSize.variantKey!);
    expect(service.cartItems()).toHaveSize(1);
    expect(service.cartItems()[0].dhotiSize).toBe(DhotiSize.EightMulam);
  });

  it('does not let cart quantities exceed variant stock', () => {
    const product = service.products()[0];

    service.addToCart({ ...product, price: 3499, stockQuantity: 2 }, 3);

    expect(service.cartItems()[0].quantity).toBe(2);
    service.increaseQuantity(service.cartItems()[0].variantKey!);
    expect(service.cartItems()[0].quantity).toBe(2);
  });

});
