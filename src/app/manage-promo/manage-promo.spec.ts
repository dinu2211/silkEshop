import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { DhotiSize, ProductCategory, type Product } from '../cart-service';
import { Supabase, type Promo } from '../services/supabase';
import { ManagePromo } from './manage-promo';

describe('ManagePromo', () => {
  let component: ManagePromo;
  let fixture: ComponentFixture<ManagePromo>;
  let supabase: jasmine.SpyObj<Supabase>;

  const promo: Promo = {
    id: 'promo-id',
    code: 'WEAVE10',
    discountType: 'percentage',
    discountValue: 10,
    isActive: true,
    createdAt: '2026-11-06T10:00:00Z',
  };
  const pendingProduct: Product = {
    id: 'product-id',
    name: 'Silk Dhoti',
    description: 'A new silk dhoti product.',
    category: ProductCategory.SilkDhoti,
    imageUrls: ['https://example.com/product.jpg'],
    variantPrices: [{ dhotiSize: DhotiSize.EightMulam, price: 2500, quantity: 3 }],
    isApproved: false,
  };

  beforeEach(async () => {
    supabase = jasmine.createSpyObj<Supabase>('Supabase', [
      'isOrderAdminSignedIn',
      'getAdminScreenAccess',
      'getAdminProducts',
      'signInOrderAdmin',
      'signOutOrderAdmin',
      'getAdminPromos',
      'saveAdminPromo',
      'getProductsPendingApproval',
      'approveProduct',
      'rejectPendingProduct',
    ]);
    supabase.isOrderAdminSignedIn.and.resolveTo(true);
    supabase.getAdminScreenAccess.and.resolveTo(['manage-promo']);
    supabase.getAdminProducts.and.resolveTo([]);
    supabase.getAdminPromos.and.resolveTo([promo]);
    supabase.saveAdminPromo.and.resolveTo(promo);
    supabase.getProductsPendingApproval.and.resolveTo([pendingProduct]);
    supabase.approveProduct.and.resolveTo({ ...pendingProduct, isApproved: true });
    supabase.rejectPendingProduct.and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [ManagePromo],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: Supabase, useValue: supabase },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ManagePromo);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise<void>((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  });

  it('loads promo codes only after confirming the screen permission', () => {
    expect(supabase.getAdminScreenAccess).toHaveBeenCalled();
    expect(supabase.getAdminPromos).toHaveBeenCalled();
    expect(supabase.getProductsPendingApproval).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Silk Dhoti');
    expect(fixture.nativeElement.textContent).toContain('Products to approve');
    expect(component.activeTab()).toBe('approval');
    expect(fixture.nativeElement.querySelector('a[routerLink="/view-stock"]')).toBeTruthy();

    component.activeTab.set('promos');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('WEAVE10');
    expect(fixture.nativeElement.textContent).toContain('10% off');
  });

  it('does not load promo data for an administrator without promo access', async () => {
    supabase.getAdminScreenAccess.and.resolveTo([]);
    component.hasPromoAccess.set(false);
    component.isAdmin.set(false);
    await component.signIn();
    fixture.detectChanges();

    expect(supabase.getAdminPromos).toHaveBeenCalledTimes(1);
    expect(component.hasPromoAccess()).toBeFalse();
  });

  it('approves a pending product and removes it from the review queue', async () => {
    await component.approveProduct(pendingProduct);

    expect(supabase.approveProduct).toHaveBeenCalledWith(pendingProduct.id);
    expect(component.pendingProducts()).toEqual([]);
    expect(component.successMessage()).toContain('has been approved');
  });

  it('rejects pending changes and removes them from the review queue', async () => {
    const productWithPendingChanges = { ...pendingProduct, isPendingUpdate: true };
    component.pendingProducts.set([productWithPendingChanges]);

    await component.rejectProduct(productWithPendingChanges);

    expect(supabase.rejectPendingProduct).toHaveBeenCalledWith(pendingProduct.id);
    expect(component.pendingProducts()).toEqual([]);
    expect(component.successMessage()).toContain('approved product remains unchanged');
  });

  it('highlights only the product values that differ from the approved version', () => {
    component.approvedProducts.set([{ ...pendingProduct, name: 'Previous name', isApproved: true }]);
    component.pendingProducts.set([
      { ...pendingProduct, name: 'Updated name', isPendingUpdate: true },
    ]);
    fixture.detectChanges();

    const changedValues = fixture.nativeElement.querySelectorAll('.changed-value');
    expect(changedValues.length).toBe(1);
    expect(changedValues[0].textContent).toContain('Updated name');
  });

  it('creates a promo with a normalized code and the selected discount settings', async () => {
    component.startNewPromo();
    component.draft = {
      code: ' weave25 ',
      discountType: 'fixed',
      discountValue: 250,
      isActive: true,
    };

    await component.savePromo();

    expect(supabase.saveAdminPromo).toHaveBeenCalledWith({
      id: '',
      code: 'WEAVE25',
      discountType: 'fixed',
      discountValue: 250,
      isActive: true,
    });
    expect(component.successMessage()).toBe('Promo created.');
  });

  it('toggles an existing promo active state', async () => {
    supabase.saveAdminPromo.and.resolveTo({ ...promo, isActive: false });

    await component.togglePromo(promo);

    expect(supabase.saveAdminPromo).toHaveBeenCalledWith({
      id: promo.id,
      code: promo.code,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      isActive: false,
    });
    expect(component.promos()[0].isActive).toBeFalse();
  });
});
