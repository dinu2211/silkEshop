import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import {
  DhotiSize,
  DhotiType,
  ProductCategory,
  ProductCollection,
  type Product,
} from '../cart-service';
import { Supabase } from '../services/supabase';
import { ManageProducts } from './manage-products';

describe('ManageProducts', () => {
  let component: ManageProducts;
  let fixture: ComponentFixture<ManageProducts>;
  let supabase: jasmine.SpyObj<Supabase>;

  const product: Product = {
    id: 'silk-dhoti-01',
    name: 'Silk Dhoti',
    description: 'Traditional silk dhoti.',
    imageUrls: ['assets/images/silk-dhoti-01.jpeg'],
    category: ProductCategory.SilkDhoti,
    collection: ProductCollection.Wedding,
    idealFor: null,
    variantPrices: [
      {
        dhotiSize: DhotiSize.EightMulam,
        dhotiType: DhotiType.WithVelcroPocket,
        price: 3499,
        quantity: 4,
      },
    ],
  };

  beforeEach(async () => {
    supabase = jasmine.createSpyObj<Supabase>('Supabase', [
      'isOrderAdminSignedIn',
      'signInOrderAdmin',
      'signOutOrderAdmin',
      'getAdminProducts',
      'createProduct',
      'updateProduct',
    ]);
    supabase.isOrderAdminSignedIn.and.resolveTo(true);
    supabase.getAdminProducts.and.resolveTo([product]);
    supabase.createProduct.and.callFake(async (newProduct) => ({
      ...newProduct,
      id: 'new-product',
      isApproved: false,
    }));
    supabase.updateProduct.and.callFake(async (id, updates) => ({
      ...product,
      ...updates,
      id,
      isApproved: false,
    }));

    await TestBed.configureTestingModule({
      imports: [ManageProducts],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: Supabase, useValue: supabase },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ManageProducts);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise<void>((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  });

  it('loads the catalog for an existing administrator session', () => {
    expect(component).toBeTruthy();
    expect(supabase.getAdminProducts).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Silk Dhoti');
  });

  it('uses the order-management sign-in and creates a product', async () => {
    component.isAdmin.set(false);
    component.userId = 'admin@example.com';
    component.password = 'a-secure-password';
    await component.signIn();

    expect(supabase.signInOrderAdmin).toHaveBeenCalledWith(
      'admin@example.com',
      'a-secure-password',
    );

    component.startNewProduct();
    component.draft = {
      name: 'New Dhoti',
      description: 'A new traditional dhoti.',
      images: [{ url: 'assets/images/new-dhoti.jpeg' }],
      category: ProductCategory.SilkDhoti,
      collection: '',
      isPremium: true,
      idealFor: '',
      variantPrices: [
        {
          dhotiSize: DhotiSize.EightMulam,
          dhotiType: DhotiType.WithVelcroPocket,
          shirtSize: '',
          sleeveLength: '',
          price: 2500,
          quantity: 3,
        },
      ],
    };

    await component.saveProduct();

    expect(supabase.createProduct).toHaveBeenCalledWith(
      jasmine.objectContaining({
        name: 'New Dhoti',
        isPremium: true,
        variantPrices: [jasmine.objectContaining({ price: 2500, quantity: 3 })],
      }),
    );
    expect(component.products()).toEqual([product]);
    expect(component.successMessage()).toBe('Product submitted and is waiting for admin approval.');
  });

  it('updates an existing product with the same admin session', async () => {
    component.editProduct(product);
    component.draft.name = 'Updated Silk Dhoti';

    await component.saveProduct();

    expect(supabase.updateProduct).toHaveBeenCalledWith(
      product.id,
      jasmine.objectContaining({ name: 'Updated Silk Dhoti' }),
    );
    expect(component.products()[0].name).toBe(product.name);
    expect(component.successMessage()).toBe(
      'Product changes submitted and are waiting for admin approval.',
    );
  });

  it('does not allow editing a product with changes waiting for approval', () => {
    const pendingProduct = { ...product, isPendingUpdate: true };

    component.editProduct(pendingProduct);

    expect(component.isEditorOpen()).toBeFalse();
    expect(component.errorMessage()).toContain('changes are awaiting approval');
  });
});
