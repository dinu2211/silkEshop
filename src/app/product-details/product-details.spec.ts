import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import {
  CartService,
  DhotiType,
  DhotiSize,
  ProductCategory,
  ShirtSize,
  SleeveLength,
} from '../cart-service';
import { ProductService } from '../product-service';
import { Supabase } from '../services/supabase';
import { ProductDetails } from './product-details';

describe('ProductDetails', () => {
  let component: ProductDetails;
  let fixture: ComponentFixture<ProductDetails>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductDetails],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: Supabase,
          useValue: {
            getProducts: jasmine.createSpy('getProducts').and.resolveTo([
              {
                id: 'silk-dhoti-set-01',
                name: 'Silk Dhoti Set',
                description: 'Traditional silk dhoti set.',
                imageUrls: ['assets/images/silk-dhoti-01.jpeg'],
                category: ProductCategory.SilkDhotiSet,
                variantPrices: [{ price: 3499, quantity: 10 }],
              },
            ]),
          },
        },
      ],
    })
    .compileComponents();

    await TestBed.inject(ProductService).loadProducts();
    fixture = TestBed.createComponent(ProductDetails);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('product', TestBed.inject(CartService).products()[0]);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('lets the user navigate the product image gallery', () => {
    const rootElement: HTMLElement = fixture.nativeElement;
    const product = TestBed.inject(CartService).products()[0];
    component.product = {
      ...product,
      imageUrls: ['assets/images/silk-dhoti-01.jpeg', 'assets/images/silk-dhoti-16.jpeg'],
    };
    fixture.detectChanges();

    rootElement
      .querySelector<HTMLButtonElement>('[aria-label="Next product image"]')!
      .click();
    fixture.detectChanges();

    expect(component.selectedImageIndex).toBe(1);
    expect(rootElement.textContent).toContain('2 / 2');
    expect(rootElement.querySelector<HTMLImageElement>('.product-image')!.src)
      .toContain('silk-dhoti-16.jpeg');

    rootElement
      .querySelector<HTMLButtonElement>('[aria-label="Previous product image"]')!
      .click();

    expect(component.selectedImageIndex).toBe(0);
  });

  it('opens the image in a full-screen viewer and supports bounded zoom controls', async () => {
    const rootElement: HTMLElement = fixture.nativeElement;
    rootElement.querySelector<HTMLButtonElement>('.image-open-button')!.click();
    await fixture.whenStable();

    expect(rootElement.querySelector('[aria-label="Full-screen image of Silk Dhoti Set"]'))
      .toBeTruthy();

    const zoomIn = rootElement.querySelector<HTMLButtonElement>('[aria-label="Zoom in"]')!;
    zoomIn.click();
    await fixture.whenStable();
    expect(component.zoomPercent).toBe(125);

    for (let index = 0; index < 20; index += 1) {
      zoomIn.click();
    }
    await fixture.whenStable();
    expect(component.zoomLevel).toBe(component.maximumZoom);
    expect(zoomIn.disabled).toBeTrue();

    rootElement.querySelector<HTMLButtonElement>('[aria-label="Zoom out"]')!.click();
    await fixture.whenStable();
    expect(component.zoomPercent).toBe(275);

    component.onEscape();
    await fixture.whenStable();
    expect(component.isImageViewerOpen).toBeFalse();
    expect(component.zoomLevel).toBe(component.minimumZoom);
  });

  it('zooms toward the point clicked on the full-screen image', async () => {
    const rootElement: HTMLElement = fixture.nativeElement;
    rootElement.querySelector<HTMLButtonElement>('.image-open-button')!.click();
    await fixture.whenStable();

    const image = rootElement.querySelector<HTMLImageElement>('.fullscreen-image')!;
    spyOn(image, 'getBoundingClientRect').and.returnValue(new DOMRect(100, 50, 400, 600));
    image.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 300, clientY: 200 }));
    await fixture.whenStable();

    expect(component.zoomLevel).toBe(2);
    expect(component.zoomOriginX).toBe(50);
    expect(component.zoomOriginY).toBe(25);
    expect(image.style.transformOrigin).toBe('50% 25%');

    rootElement.querySelector<HTMLButtonElement>('[aria-label="Reset zoom"]')!.click();
    await fixture.whenStable();
    expect(component.zoomOriginX).toBe(50);
    expect(component.zoomOriginY).toBe(50);
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
      .toContain(product.imageUrls[0]);
    expect(rootElement.textContent).toContain('Dhoti size');
    expect(rootElement.textContent).toContain('Dhoti type');
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

  it('updates the displayed price for the selected shirt and dhoti options', () => {
    const product = TestBed.inject(CartService).products()[0];
    component.product = {
      ...product,
      variantPrices: [
        {
          dhotiSize: DhotiSize.EightMulam,
          shirtSize: ShirtSize.Medium,
          sleeveLength: SleeveLength.FullSleeve,
          dhotiType: DhotiType.WithVelcroPocket,
          price: 4299,
          quantity: 5,
        },
        {
          dhotiSize: DhotiSize.EightMulam,
          shirtSize: ShirtSize.Medium,
          sleeveLength: SleeveLength.FullSleeve,
          dhotiType: DhotiType.WithoutVelcroPocket,
          price: 3999,
          quantity: 2,
        },
      ],
    };
    fixture.detectChanges();

    expect(component.selectedPrice).toBe(4299);
    const rootElement: HTMLElement = fixture.nativeElement;
    const withoutPocket = Array.from(
      rootElement.querySelectorAll<HTMLButtonElement>('.option-button'),
    ).find((button) => button.textContent?.includes(DhotiType.WithoutVelcroPocket));
    withoutPocket!.click();
    fixture.detectChanges();

    expect(component.selectedPrice).toBe(3999);
  });

  it('shows a red low-stock label when three or fewer units remain', () => {
    component.product = {
      ...component.product,
      variantPrices: [
        {
          dhotiSize: DhotiSize.EightMulam,
          shirtSize: ShirtSize.Medium,
          sleeveLength: SleeveLength.FullSleeve,
          dhotiType: DhotiType.WithVelcroPocket,
          price: 4299,
          quantity: 3,
        },
      ],
    };
    fixture.detectChanges();

    const stockMessage: HTMLElement =
      fixture.nativeElement.querySelector('.stock-message');
    expect(stockMessage.textContent).toContain('Only 3 left');
    expect(stockMessage.classList).toContain('low-stock');

    component.product = {
      ...component.product,
      variantPrices: component.product.variantPrices.map((variant) => ({
        ...variant,
        quantity: 4,
      })),
    };
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.stock-message').textContent)
      .toContain('4 available');
    expect(fixture.nativeElement.querySelector('.stock-message').classList)
      .not.toContain('low-stock');
  });

  it('adds the selected options and quantity to the cart', () => {
    const cartService = TestBed.inject(CartService);
    const product = cartService.products().find(
      (item) => item.category === ProductCategory.SilkDhotiSet,
    )!;
    component.product = {
      ...product,
      variantPrices: [
        {
          dhotiSize: DhotiSize.TenMulam,
          shirtSize: ShirtSize.Medium,
          sleeveLength: SleeveLength.FullSleeve,
          dhotiType: DhotiType.WithVelcroPocket,
          price: 4299,
          quantity: 3,
        },
      ],
    };
    component.dhotiSize = DhotiSize.TenMulam;
    component.quantity = 3;

    component.addToCart();

    expect(cartService.cartItems()).toHaveSize(1);
    expect(cartService.cartItems()[0]).toEqual(
      jasmine.objectContaining({
        id: product.id,
        quantity: 3,
        dhotiSize: DhotiSize.TenMulam,
        dhotiType: DhotiType.WithVelcroPocket,
        price: 4299,
        shirtSize: ShirtSize.Medium,
        sleeveLength: SleeveLength.FullSleeve,
      }),
    );
  });

  it('does not allow the quantity to decrease below one', () => {
    component.decreaseQuantity();

    expect(component.quantity).toBe(1);
  });

  it('limits cart quantity to the selected variant stock', () => {
    component.product = {
      ...component.product,
      variantPrices: [
        {
          dhotiSize: DhotiSize.EightMulam,
          dhotiType: DhotiType.WithVelcroPocket,
          shirtSize: ShirtSize.Medium,
          sleeveLength: SleeveLength.FullSleeve,
          price: 4299,
          quantity: 1,
        },
      ],
    };

    expect(component.remainingQuantity).toBe(1);
    component.increaseQuantity();
    expect(component.quantity).toBe(1);

    component.addToCart();

    expect(TestBed.inject(CartService).cartItems()[0].quantity).toBe(1);
    expect(component.remainingQuantity).toBe(0);
  });
});
