import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { CartService, Product, ProductCategory } from '../cart-service';
import { Supabase } from '../services/supabase';
import { ViewCart } from './view-cart';

describe('ViewCart', () => {
  let component: ViewCart;
  let fixture: ComponentFixture<ViewCart>;
  let supabase: jasmine.SpyObj<Supabase>;
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
    supabase = jasmine.createSpyObj<Supabase>('Supabase', ['getProducts']);
    supabase.getProducts.and.resolveTo(products);

    await TestBed.configureTestingModule({
      imports: [ViewCart],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: Supabase, useValue: supabase },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(ViewCart);
    component = fixture.componentInstance;
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows selected products and updates their quantity', () => {
    const cartService = TestBed.inject(CartService);
    const product = cartService.products()[0];
    cartService.addToCart({ ...product, price: product.variantPrices[0].price });
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
    cartService.addToCart({ ...product, price: product.variantPrices[0].price });
    fixture.detectChanges();

    fixture.nativeElement.querySelector(
      `[aria-label="Remove ${product.name} from cart"]`,
    ).click();
    fixture.detectChanges();

    expect(cartService.cartItems()).toHaveSize(0);
    expect(fixture.nativeElement.textContent).toContain('Your cart is empty');
  });

  it('checks current stock before navigating to checkout', async () => {
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    const cartService = TestBed.inject(CartService);
    const product = products[0];
    cartService.addToCart(
      { ...product, price: product.variantPrices[0].price },
      2,
    );

    await component.goToCheckout();

    expect(supabase.getProducts).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/checkout']);
    expect(component.availabilityError()).toBeNull();
  });

  it('blocks checkout and reports when the selected variant has insufficient stock', async () => {
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    const cartService = TestBed.inject(CartService);
    const product = products[0];
    cartService.addToCart(
      { ...product, price: product.variantPrices[0].price },
      2,
    );
    supabase.getProducts.and.resolveTo([
      { ...product, variantPrices: [{ ...product.variantPrices[0], quantity: 1 }] },
    ]);

    await component.goToCheckout();

    expect(navigate).not.toHaveBeenCalled();
    expect(component.availabilityError()).toContain('2 in cart, but only 1 available');
    expect(component.isCheckingAvailability()).toBeFalse();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.checkout-button').textContent)
      .toContain('Checkout');
  });

  it('stays in the cart if current availability cannot be checked', async () => {
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    const cartService = TestBed.inject(CartService);
    const product = products[0];
    cartService.addToCart({ ...product, price: product.variantPrices[0].price });
    supabase.getProducts.and.rejectWith(new Error('Supabase unavailable'));
    spyOn(console, 'error');

    await component.goToCheckout();

    expect(navigate).not.toHaveBeenCalled();
    expect(component.availabilityError()).toContain('Could not check product availability');
    expect(component.isCheckingAvailability()).toBeFalse();
  });
});
