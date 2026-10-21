import { TestBed } from '@angular/core/testing';

import { CartService, DhotiSize, ProductCategory } from './cart-service';

describe('CartService', () => {
  let service: CartService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CartService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('provides 15 silk dhotis, 10 regular dhotis, and 5 combo sets', () => {
    const products = service.products();

    expect(products).toHaveSize(30);
    expect(products.filter((product) => product.category === ProductCategory.SilkDhoti))
      .toHaveSize(15);
    expect(products.filter((product) => product.category === ProductCategory.PlainDhoti))
      .toHaveSize(10);
    expect(products.filter((product) => product.category === ProductCategory.ComboSet))
      .toHaveSize(5);
    expect(new Set(products.map((product) => product.id)).size).toBe(products.length);
    expect(products.every((product) => product.name && product.description && product.price > 0))
      .toBeTrue();
    expect(products.every((product) => product.imageUrl?.startsWith('https://'))).toBeTrue();
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

    service.addToCart({ ...product, dhotiSize: DhotiSize.EightMulam }, 2);
    service.addToCart({ ...product, dhotiSize: DhotiSize.TenMulam });

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
});
