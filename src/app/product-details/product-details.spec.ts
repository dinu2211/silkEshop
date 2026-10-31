import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

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
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductDetails],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ProductDetails);
    component = fixture.componentInstance;
    httpTesting.expectOne('/api/products').flush([
      {
        id: 'silk-dhoti-set-01',
        name: 'Silk Dhoti Set',
        description: 'Traditional silk dhoti set.',
        price: 3499,
        imageUrl: 'assets/images/silk-dhoti-01.jpeg',
        category: ProductCategory.SilkDhotiSet,
      },
    ]);
    component.product = TestBed.inject(CartService).products()[0];
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows product information and lets the user configure the quantity and clothing options', () => {
    const rootElement: HTMLElement = fixture.nativeElement;
    const product = TestBed.inject(CartService).products().find(
      (item) => item.category === ProductCategory.SilkDhotiSet,
    )!;
    component.product = product;
    fixture.detectChanges();

    expect(rootElement.textContent).toContain(product.name);
    expect(rootElement.querySelector<HTMLImageElement>('.product-image')!.src)
      .toContain(product.imageUrl);
    expect(rootElement.textContent).toContain('Dhoti size');
    expect(rootElement.textContent).toContain('Shirt size');
    expect(rootElement.textContent).toContain('Sleeve length');

    const options = rootElement.querySelectorAll<HTMLButtonElement>('.option-button');
    options[2].click();
    options[5].click();
    options[7].click();
    rootElement.querySelector<HTMLButtonElement>('[aria-label="Increase quantity"]')!.click();
    fixture.detectChanges();

    expect(component.quantity).toBe(2);
    expect(rootElement.textContent).toContain('2');
  });

  it('adds the selected options and quantity to the cart', () => {
    const cartService = TestBed.inject(CartService);
    const product = cartService.products().find(
      (item) => item.category === ProductCategory.SilkDhotiSet,
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

  afterEach(() => {
    httpTesting.verify();
  });
});
