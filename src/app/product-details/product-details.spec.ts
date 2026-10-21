import { ComponentFixture, TestBed } from '@angular/core/testing';

import {
  CartService,
  DhotiSize,
  ProductCategory,
  ShirtSize,
  SleeveLength,
} from '../cart-service';
import { ProductDetails } from './product-details';

describe('ProductDetails', () => {
  let component: ProductDetails;
  let fixture: ComponentFixture<ProductDetails>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductDetails]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductDetails);
    component = fixture.componentInstance;
    component.product = TestBed.inject(CartService).products()[0];
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows product information and lets the user configure the quantity and clothing options', () => {
    const product = TestBed.inject(CartService).products().find(
      (item) => item.category === ProductCategory.ComboSet,
    )!;
    component.product = product;
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(product.name);
    expect(fixture.nativeElement.querySelector<HTMLImageElement>('.product-image')!.src)
      .toContain(product.imageUrl);
    expect(fixture.nativeElement.textContent).toContain('Dhoti size');
    expect(fixture.nativeElement.textContent).toContain('Shirt size');
    expect(fixture.nativeElement.textContent).toContain('Sleeve length');

    const options = fixture.nativeElement.querySelectorAll<HTMLButtonElement>('.option-button');
    options[2].click();
    options[5].click();
    options[7].click();
    fixture.nativeElement.querySelector('[aria-label="Increase quantity"]').click();
    fixture.detectChanges();

    expect(component.quantity).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('2');
  });

  it('adds the selected options and quantity to the cart', () => {
    const cartService = TestBed.inject(CartService);
    const product = cartService.products().find(
      (item) => item.category === ProductCategory.ComboSet,
    )!;
    component.product = product;
    component.dhotiSize = DhotiSize.TenMulam;
    component.quantity = 3;

    component.addToCart();

    expect(cartService.cartItems()).toHaveSize(1);
    expect(cartService.cartItems()[0]).toEqual(
      jasmine.objectContaining({
        id: product.id,
        quantity: 3,
        dhotiSize: DhotiSize.TenMulam,
        shirtSize: ShirtSize.Medium,
        sleeveLength: SleeveLength.FullSleeve,
      }),
    );
  });

  it('does not allow the quantity to decrease below one', () => {
    component.decreaseQuantity();

    expect(component.quantity).toBe(1);
  });
});
