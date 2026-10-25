import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { CartService, Product, ProductCategory } from '../cart-service';
import { ViewCart } from './view-cart';

describe('ViewCart', () => {
  let component: ViewCart;
  let fixture: ComponentFixture<ViewCart>;
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

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewCart],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ViewCart);
    component = fixture.componentInstance;
    httpTesting.expectOne('/api/products').flush(products);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows selected products and updates their quantity', () => {
    const cartService = TestBed.inject(CartService);
    const product = cartService.products()[0];
    cartService.addToCart(product);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(product.name);
    fixture.nativeElement.querySelector(
      `[aria-label="Increase quantity of ${product.name}"]`,
    ).click();
    fixture.detectChanges();

    expect(cartService.quantityFor(product.id)).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('2');
  });

  it('removes a product from the cart', () => {
    const cartService = TestBed.inject(CartService);
    const product = cartService.products()[0];
    cartService.addToCart(product);
    fixture.detectChanges();

    fixture.nativeElement.querySelector(
      `[aria-label="Remove ${product.name} from cart"]`,
    ).click();
    fixture.detectChanges();

    expect(cartService.cartItems()).toHaveSize(0);
    expect(fixture.nativeElement.textContent).toContain('Your cart is empty');
  });

  afterEach(() => {
    httpTesting.verify();
  });
});
