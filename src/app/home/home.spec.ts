import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Product, ProductCategory, ProductCollection, ProductIdealFor } from '../cart-service';
import { ProductService } from '../product-service';
import { Supabase } from '../services/supabase';

import { Home } from './home';

describe('Home', () => {
  let component: Home;
  let fixture: ComponentFixture<Home>;
  let supabase: jasmine.SpyObj<Supabase>;
  const products: Product[] = [
    {
      id: 'silk-dhoti-01',
      name: 'Kanchipuram Silk Dhoti - Gold Zari Border',
      description: 'Traditional cream silk dhoti with an elegant gold zari border.',
      imageUrls: ['assets/images/silk-dhoti-01.jpeg'],
      category: ProductCategory.SilkDhoti,
      collection: ProductCollection.Wedding,
      idealFor: ProductIdealFor.Men,
      variantPrices: [{ price: 3499, quantity: 2 }],
    },
    {
      id: 'plain-dhoti-01',
      name: 'Cotton Dhoti - White with Gold Border',
      description: 'Breathable white cotton dhoti with a simple gold-tone border.',
      imageUrls: ['assets/images/silk-dhoti-16.jpeg'],
      category: ProductCategory.PlainDhoti,
      collection: ProductCollection.Function,
      variantPrices: [{ price: 799, quantity: 1 }],
    },
  ];

  beforeEach(async () => {
    supabase = jasmine.createSpyObj<Supabase>('Supabase', ['getProducts']);
    supabase.getProducts.and.resolveTo(products);

    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        { provide: Supabase, useValue: supabase },
        { provide: ProductService, useValue: { products: signal(products) } },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Home);
    component = fixture.componentInstance;
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows only products in the selected collection', () => {
    const collection = ProductCollection.Wedding;
    const expectedProducts = component.products().filter(
      (product) => product.collection === collection,
    );

    component.selectCollection(collection);
    fixture.detectChanges();

    const displayedNames = Array.from(
      fixture.nativeElement.querySelectorAll('.example-card h3'),
      (heading: Element) => heading.textContent?.trim(),
    );
    expect(displayedNames).toEqual(expectedProducts.map((product) => product.name));
  });

  it('shows all products when the collection filter is cleared', () => {
    component.selectCollection(ProductCollection.Wedding);
    component.selectCollection(null);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.example-card').length).toBe(
      component.products().length,
    );
  });

  it('offers the requested collections and filters uncategorized products separately', () => {
    expect(component.collections).toEqual(Object.values(ProductCollection));
    component.products.update((products) => [
      ...products,
      {
        ...products[0],
        id: 'unassigned-product',
        collection: null,
        variantPrices: [{ price: 3499, quantity: 1 }],
      },
    ]);

    component.selectCollection('unassigned');

    expect(component.filteredProducts.map((product) => product.id)).toEqual([
      'unassigned-product',
    ]);
  });

  it('shows the lowest in-stock variant price on the product card', () => {
    const product = component.products()[0];
    product.variantPrices = [
      { price: 2999, quantity: 0 },
      { price: 3999, quantity: 2 },
    ];

    expect(component.startingPrice(product)).toBe(3999);
  });

  it('hides products with no variants in stock', () => {
    component.products.update((currentProducts) => [
      ...currentProducts,
      {
        ...currentProducts[0],
        id: 'out-of-stock',
        variantPrices: [{ price: 2999, quantity: 0 }],
      },
    ]);
    fixture.detectChanges();

    expect(component.filteredProducts.map((product) => product.id)).not.toContain('out-of-stock');
    expect(component.filteredProducts).toHaveSize(2);
    expect(fixture.nativeElement.querySelectorAll('.example-card')).toHaveSize(2);
  });

  it('loads products from Supabase', () => {
    expect(supabase.getProducts).toHaveBeenCalled();
    expect(component.products()).toEqual(products);
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
