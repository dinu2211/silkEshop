import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Home } from './home';

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

  it('shows only products in the selected category', () => {
    const category = component.categories[0];
    const expectedProducts = component.products().filter((product) => product.category === category);

    component.selectCategory(category);
    fixture.detectChanges();

    const displayedNames = Array.from(
      fixture.nativeElement.querySelectorAll('.example-card h3'),
      (heading: Element) => heading.textContent?.trim(),
    );
    expect(displayedNames).toEqual(expectedProducts.map((product) => product.name));
  });

  it('shows all products when the category filter is cleared', () => {
    component.selectCategory(component.categories[0]);
    component.selectCategory(null);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.example-card').length).toBe(
      component.products().length,
    );
  });

  it('opens the product details dialog from a product card', () => {
    const product = component.products()[0];

    fixture.nativeElement.querySelector('.add-to-cart').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#product-title').textContent).toContain(
      product.name,
    );

    fixture.nativeElement.querySelector('[aria-label="Close product details"]').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });
});
