import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { CartService, DhotiSize, Product, ProductCategory } from './cart-service';

describe('CartService', () => {
  let service: CartService;
  let httpTesting: HttpTestingController;
  const products: Product[] = [
    {
      id: 'silk-dhoti-01',
      name: 'Kanchipuram Silk Dhoti - Gold Zari Border',
      description: 'Traditional cream silk dhoti with an elegant gold zari border.',
      price: 3499,
      imageUrl: 'assets/images/silk-dhoti-01.jpeg',
      category: ProductCategory.SilkDhoti,
    },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    service = TestBed.inject(CartService);
    httpTesting.expectOne('/api/products').flush(products);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('uses products returned by the products API', () => {
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

  afterEach(() => {
    httpTesting.verify();
  });
});
