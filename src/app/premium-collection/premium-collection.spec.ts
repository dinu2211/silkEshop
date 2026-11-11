import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Product, ProductCategory, ProductCollection } from '../cart-service';
import { Supabase } from '../services/supabase';
import { PremiumCollection } from './premium-collection';

describe('PremiumCollection', () => {
  let component: PremiumCollection;
  let fixture: ComponentFixture<PremiumCollection>;
  let supabase: jasmine.SpyObj<Supabase>;

  const products: Product[] = [
    {
      id: 'premium-silk-dhoti',
      name: 'Premium Silk Dhoti',
      description: 'A refined silk dhoti for special occasions.',
      imageUrls: ['assets/images/silk-dhoti-01.jpeg'],
      category: ProductCategory.SilkDhoti,
      collection: ProductCollection.Wedding,
      isPremium: true,
      variantPrices: [
        { price: 3499, quantity: 0 },
        { price: 3999, quantity: 1 },
      ],
    },
    {
      id: 'everyday-dhoti',
      name: 'Everyday Dhoti',
      description: 'A comfortable cotton dhoti.',
      imageUrls: ['assets/images/silk-dhoti-16.jpeg'],
      category: ProductCategory.PlainDhoti,
      collection: ProductCollection.Function,
      isPremium: false,
      variantPrices: [{ price: 799, quantity: 2 }],
    },
  ];

  beforeEach(async () => {
    supabase = jasmine.createSpyObj<Supabase>('Supabase', ['getProducts']);
    supabase.getProducts.and.resolveTo(products);

    await TestBed.configureTestingModule({
      imports: [PremiumCollection],
      providers: [
        provideZonelessChangeDetection(),
        { provide: Supabase, useValue: supabase },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PremiumCollection);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('loads and displays only premium products', () => {
    expect(supabase.getProducts).toHaveBeenCalled();
    expect(component.premiumProducts.map((product) => product.id)).toEqual([
      'premium-silk-dhoti',
    ]);
    expect(fixture.nativeElement.querySelectorAll('.product-card')).toHaveSize(1);
    expect(fixture.nativeElement.textContent).toContain('Premium Silk Dhoti');
    expect(fixture.nativeElement.textContent).not.toContain('Everyday Dhoti');
  });

  it('shows the lowest in-stock price and opens product details', () => {
    const product = component.premiumProducts[0];

    expect(component.startingPrice(product)).toBe(3999);
    component.openProductDetails(product);

    expect(component.selectedProduct).toBe(product);
    component.closeProductDetails();
    expect(component.selectedProduct).toBeNull();
  });

  it('shows an empty state when no products are marked premium', async () => {
    component.products.set(products.map((product) => ({ ...product, isPremium: false })));
    component.loading.set(false);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Our premium collection is being curated');
    expect(fixture.nativeElement.querySelectorAll('.product-card')).toHaveSize(0);
  });
});
