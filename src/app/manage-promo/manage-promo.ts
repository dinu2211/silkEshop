import { CurrencyPipe, DatePipe, isPlatformBrowser } from '@angular/common';
import { Component, inject, PLATFORM_ID, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Supabase, type Promo, type PromoDiscountType } from '../services/supabase';
import type { Product } from '../cart-service';

interface PromoDraft {
  code: string;
  discountType: PromoDiscountType;
  discountValue: number | null;
  isActive: boolean;
}

const emptyDraft = (): PromoDraft => ({
  code: '',
  discountType: 'percentage',
  discountValue: null,
  isActive: true,
});

@Component({
  selector: 'app-manage-promo',
  imports: [CurrencyPipe, DatePipe, FormsModule, RouterLink],
  templateUrl: './manage-promo.html',
  styleUrl: './manage-promo.scss',
})
export class ManagePromo {
  private readonly supabase = inject(Supabase);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly isCheckingSession = signal(true);
  readonly isAdmin = signal(false);
  readonly hasPromoAccess = signal(false);
  readonly activeTab = signal<'approval' | 'promos'>('approval');
  readonly pendingProducts = signal<Product[]>([]);
  readonly promos = signal<Promo[]>([]);
  readonly isLoading = signal(false);
  readonly isLoadingPending = signal(false);
  readonly approvingProductId = signal<string | null>(null);
  readonly isSigningIn = signal(false);
  readonly isSaving = signal(false);
  readonly updatingPromoId = signal<string | null>(null);
  readonly isEditorOpen = signal(false);
  readonly editingPromoId = signal<string | null>(null);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  userId = '';
  password = '';
  draft = emptyDraft();

  constructor() {
    if (this.isBrowser) {
      void this.restoreAdminSession();
    } else {
      this.isCheckingSession.set(false);
    }
  }

  async signIn(): Promise<void> {
    const userId = this.userId.trim();
    if (!userId || !this.password) {
      this.errorMessage.set('Enter your administrator user ID and password.');
      return;
    }

    this.isSigningIn.set(true);
    this.errorMessage.set('');
    try {
      await this.supabase.signInOrderAdmin(userId, this.password);
      this.password = '';
      this.isAdmin.set(true);
      await this.loadScreenAccess();
    } catch (error: unknown) {
      console.error('Failed to sign in to promo management.', error);
      this.errorMessage.set('Sign-in failed. Check your credentials and administrator access.');
    } finally {
      this.isSigningIn.set(false);
      this.isCheckingSession.set(false);
    }
  }

  async signOut(): Promise<void> {
    this.errorMessage.set('');
    try {
      await this.supabase.signOutOrderAdmin();
      this.isAdmin.set(false);
      this.hasPromoAccess.set(false);
      this.pendingProducts.set([]);
      this.promos.set([]);
      this.closeEditor();
    } catch (error: unknown) {
      console.error('Failed to sign out of promo management.', error);
      this.errorMessage.set('Unable to sign out right now. Please try again.');
    }
  }

  startNewPromo(): void {
    this.draft = emptyDraft();
    this.editingPromoId.set(null);
    this.isEditorOpen.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  editPromo(promo: Promo): void {
    this.draft = {
      code: promo.code,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      isActive: promo.isActive,
    };
    this.editingPromoId.set(promo.id);
    this.isEditorOpen.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  closeEditor(): void {
    this.isEditorOpen.set(false);
    this.editingPromoId.set(null);
    this.draft = emptyDraft();
  }

  async savePromo(): Promise<void> {
    const code = this.draft.code.trim().toUpperCase();
    const discountValue = this.draft.discountValue;
    if (
      !/^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(code) ||
      discountValue === null ||
      !Number.isFinite(discountValue) ||
      discountValue <= 0 ||
      (this.draft.discountType === 'percentage' && discountValue > 100)
    ) {
      this.errorMessage.set(
        'Use a 2–40 character code and a positive discount (up to 100% for percentage offers).',
      );
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    try {
      const savedPromo = await this.supabase.saveAdminPromo({
        id: this.editingPromoId() ?? '',
        code,
        discountType: this.draft.discountType,
        discountValue,
        isActive: this.draft.isActive,
      });
      this.promos.update((promos) => {
        const index = promos.findIndex((promo) => promo.id === savedPromo.id);
        if (index < 0) {
          return [savedPromo, ...promos];
        }
        return promos.map((promo) => (promo.id === savedPromo.id ? savedPromo : promo));
      });
      this.successMessage.set(this.editingPromoId() ? 'Promo updated.' : 'Promo created.');
      this.closeEditor();
    } catch (error: unknown) {
      console.error('Failed to save promo.', error);
      this.errorMessage.set('Promo could not be saved. Check that the code is unique and try again.');
    } finally {
      this.isSaving.set(false);
    }
  }

  async togglePromo(promo: Promo): Promise<void> {
    if (this.updatingPromoId() !== null) {
      return;
    }

    this.updatingPromoId.set(promo.id);
    this.errorMessage.set('');
    this.successMessage.set('');
    try {
      const updatedPromo = await this.supabase.saveAdminPromo({
        id: promo.id,
        code: promo.code,
        discountType: promo.discountType,
        discountValue: promo.discountValue,
        isActive: !promo.isActive,
      });
      this.promos.update((promos) =>
        promos.map((current) => (current.id === updatedPromo.id ? updatedPromo : current)),
      );
      this.successMessage.set(`${updatedPromo.code} is now ${updatedPromo.isActive ? 'active' : 'inactive'}.`);
    } catch (error: unknown) {
      console.error('Failed to update promo active state.', error);
      this.errorMessage.set('Promo status could not be updated. Please try again.');
    } finally {
      this.updatingPromoId.set(null);
    }
  }

  async loadPromos(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    try {
      this.promos.set(await this.supabase.getAdminPromos());
    } catch (error: unknown) {
      console.error('Failed to load promos.', error);
      this.errorMessage.set('Promos could not be loaded. Please refresh and try again.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadPendingProducts(): Promise<void> {
    this.isLoadingPending.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    try {
      this.pendingProducts.set(await this.supabase.getProductsPendingApproval());
    } catch (error: unknown) {
      console.error('Failed to load products awaiting approval.', error);
      this.errorMessage.set('Products awaiting approval could not be loaded. Please try again.');
    } finally {
      this.isLoadingPending.set(false);
    }
  }

  async approveProduct(product: Product): Promise<void> {
    if (this.approvingProductId() !== null) {
      return;
    }

    this.approvingProductId.set(product.id);
    this.errorMessage.set('');
    this.successMessage.set('');
    try {
      await this.supabase.approveProduct(product.id);
      this.pendingProducts.update((products) =>
        products.filter((pendingProduct) => pendingProduct.id !== product.id),
      );
      this.successMessage.set(`${product.name} has been approved and is now visible in the shop.`);
    } catch (error: unknown) {
      console.error('Failed to approve product.', error);
      this.errorMessage.set('Product could not be approved. Please refresh and try again.');
    } finally {
      this.approvingProductId.set(null);
    }
  }

  refreshActiveTab(): void {
    if (this.activeTab() === 'approval') {
      void this.loadPendingProducts();
    } else {
      void this.loadPromos();
    }
  }

  private async restoreAdminSession(): Promise<void> {
    try {
      const isSignedIn = await this.supabase.isOrderAdminSignedIn();
      this.isAdmin.set(isSignedIn);
      if (isSignedIn) {
        await this.loadScreenAccess();
      }
    } catch (error: unknown) {
      console.error('Failed to restore promo management session.', error);
      this.errorMessage.set('Administrator access could not be checked. Please sign in again.');
    } finally {
      this.isCheckingSession.set(false);
    }
  }

  private async loadScreenAccess(): Promise<void> {
    const screens = await this.supabase.getAdminScreenAccess();
    this.hasPromoAccess.set(screens.includes('manage-promo'));
    if (this.hasPromoAccess()) {
      await Promise.all([this.loadPendingProducts(), this.loadPromos()]);
    }
  }
}
