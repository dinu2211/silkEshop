import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Home } from './home';
import { Cart } from '../cart/cart';

describe('Home', () => {
  let component: Home;
  let fixture: ComponentFixture<Home>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Home);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('adds a product to the cart when Add to Cart is clicked', () => {
    const cart = TestBed.inject(Cart);
    const addToCartButton: HTMLButtonElement =
      fixture.nativeElement.querySelector('.cartbtn');

    addToCartButton.click();
    fixture.detectChanges();

    expect(cart.itemCount()).toBe(1);
    expect(cart.items()[0]).toEqual({
      product: component.product,
      quantity: 1,
    });
  });

  it('increments the cart quantity when the same product is added again', () => {
    const cart = TestBed.inject(Cart);
    component.addToCart();
    component.addToCart();

    expect(cart.itemCount()).toBe(2);
    expect(cart.items()).toHaveSize(1);
    expect(cart.items()[0].quantity).toBe(2);
  });
});
