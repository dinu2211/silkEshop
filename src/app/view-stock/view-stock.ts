import { CurrencyPipe, isPlatformBrowser } from '@angular/common';
import { Component, computed, inject, PLATFORM_ID, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { Product, ProductVariantPrice } from '../cart-service';
import { Supabase } from '../services/supabase';

interface StockRow {
  key: string;
  product: Product;
  variant: ProductVariantPrice;
}

@Component({
  selector: 'app-view-stock',
  imports: [CurrencyPipe, FormsModule, RouterLink],
  templateUrl: './view-stock.html',
  styleUrl: './view-stock.scss',
})
export class ViewStock {
  private readonly supabase = inject(Supabase);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly isCheckingSession = signal(true);
  readonly isAdmin = signal(false);
  readonly products = signal<Product[]>([]);
  readonly isLoadingProducts = signal(false);
  readonly isSigningIn = signal(false);
  readonly errorMessage = signal('');
  readonly searchTerm = signal('');
  readonly stockRows = computed<StockRow[]>(() =>
    this.products().flatMap((product) =>
      product.variantPrices.flatMap((variant, index) =>
        variant.quantity > 0
          ? [{ key: `${product.id}-${index}`, product, variant }]
          : [],
      ),
    ),
  );
  readonly filteredStockRows = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();
    const rows = this.stockRows();
    return query
      ? rows.filter(({ product, variant }) =>
          [product.name, product.id, product.category, this.variantDescription(variant)]
            .join(' ')
            .toLowerCase()
            .includes(query),
        )
      : rows;
  });
  readonly availableProductCount = computed(
    () => new Set(this.stockRows().map(({ product }) => product.id)).size,
  );
  readonly totalAvailableUnits = computed(() =>
    this.stockRows().reduce((total, { variant }) => total + variant.quantity, 0),
  );

  userId = '';
  password = '';

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
      await this.loadProducts();
    } catch (error: unknown) {
      console.error('Failed to sign in to stock view.', error);
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
      this.products.set([]);
    } catch (error: unknown) {
      console.error('Failed to sign out of stock view.', error);
      this.errorMessage.set('Unable to sign out right now. Please try again.');
    }
  }

  async loadProducts(): Promise<void> {
    this.isLoadingProducts.set(true);
    this.errorMessage.set('');
    try {
      this.products.set(await this.supabase.getAdminProducts());
    } catch (error: unknown) {
      console.error('Failed to load available stock.', error);
      this.errorMessage.set('Available stock could not be loaded. Please refresh and try again.');
    } finally {
      this.isLoadingProducts.set(false);
    }
  }

  variantDescription(variant: ProductVariantPrice): string {
    const options = [
      variant.dhotiSize,
      variant.dhotiType,
      variant.shirtSize,
      variant.sleeveLength,
    ].filter((option) => option !== undefined);
    return options.length > 0 ? options.join(' · ') : 'Standard';
  }

  private async restoreAdminSession(): Promise<void> {
    try {
      const isAdmin = await this.supabase.isOrderAdminSignedIn();
      this.isAdmin.set(isAdmin);
      if (isAdmin) {
        await this.loadProducts();
      }
    } catch (error: unknown) {
      console.error('Failed to restore stock-view session.', error);
      this.errorMessage.set('Unable to verify your sign-in. Please sign in again.');
    } finally {
      this.isCheckingSession.set(false);
    }
  }
}
