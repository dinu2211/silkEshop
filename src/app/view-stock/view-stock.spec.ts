import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { DhotiSize, ProductCategory, type Product } from '../cart-service';
import { Supabase } from '../services/supabase';
import { ViewStock } from './view-stock';

describe('ViewStock', () => {
  let component: ViewStock;
  let fixture: ComponentFixture<ViewStock>;
  let supabase: jasmine.SpyObj<Supabase>;

  const products: Product[] = [
    {
      id: 'silk-dhoti',
      name: 'Silk Dhoti',
      description: 'Traditional silk dhoti.',
      category: ProductCategory.SilkDhoti,
      imageUrls: ['assets/images/silk-dhoti.jpeg'],
      variantPrices: [
        { dhotiSize: DhotiSize.EightMulam, price: 2500, quantity: 4 },
        { dhotiSize: DhotiSize.NineMulam, price: 2700, quantity: 0 },
      ],
      isApproved: true,
    },
    {
      id: 'out-of-stock',
      name: 'Plain Dhoti',
      description: 'A plain dhoti.',
      category: ProductCategory.PlainDhoti,
      imageUrls: ['assets/images/plain-dhoti.jpeg'],
      variantPrices: [{ price: 1800, quantity: 0 }],
      isApproved: true,
    },
  ];

  beforeEach(async () => {
    supabase = jasmine.createSpyObj<Supabase>('Supabase', [
      'isOrderAdminSignedIn',
      'signInOrderAdmin',
      'signOutOrderAdmin',
      'getAdminProducts',
    ]);
    supabase.isOrderAdminSignedIn.and.resolveTo(true);
    supabase.getAdminProducts.and.resolveTo(products);

    await TestBed.configureTestingModule({
      imports: [ViewStock],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: Supabase, useValue: supabase },
      ],
    })
      .compileComponents();

    fixture = TestBed.createComponent(ViewStock);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise<void>((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows only variants with available units and summarizes their stock', () => {
    expect(component.stockRows().length).toBe(1);
    expect(component.availableProductCount()).toBe(1);
    expect(component.totalAvailableUnits()).toBe(4);
    expect(fixture.nativeElement.textContent).toContain('Silk Dhoti');
    expect(fixture.nativeElement.textContent).not.toContain('Plain Dhoti');
    expect(fixture.nativeElement.textContent).not.toContain('9 Mulam');
  });

  it('filters available stock by product or variant', () => {
    component.searchTerm.set('8 mulam');
    fixture.detectChanges();
    expect(component.filteredStockRows().length).toBe(1);

    component.searchTerm.set('9 mulam');
    fixture.detectChanges();
    expect(component.filteredStockRows()).toEqual([]);
  });
});
