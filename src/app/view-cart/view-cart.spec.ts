import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CartService } from '../cart-service';
import { ViewCart } from './view-cart';

describe('ViewCart', () => {
  let component: ViewCart;
  let fixture: ComponentFixture<ViewCart>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewCart]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ViewCart);
    component = fixture.componentInstance;
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
});
