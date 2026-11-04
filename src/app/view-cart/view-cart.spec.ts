import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CartService, Product, ProductCategory } from '../cart-service';
import { Supabase } from '../services/supabase';
import { ViewCart } from './view-cart';

describe('ViewCart', () => {
  let component: ViewCart;
  let fixture: ComponentFixture<ViewCart>;
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
    await TestBed.configureTestingModule({
      imports: [ViewCart],
      providers: [
        {
          provide: Supabase,
          useValue: { getProducts: jasmine.createSpy('getProducts').and.resolveTo(products) },
        },
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
});
