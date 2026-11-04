import { CurrencyPipe } from '@angular/common';
import { Component, EventEmitter, HostListener, inject, Output, signal } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { Router } from '@angular/router';
import { CartService } from '../cart-service';
import { Supabase } from '../services/supabase';

@Component({
  selector: 'app-view-cart',
  imports: [CurrencyPipe, MatIcon],
  templateUrl: './view-cart.html',
  styleUrl: './view-cart.scss',
})
export class ViewCart {
  readonly cartService = inject(CartService);
  private readonly router = inject(Router);
  private readonly supabase = inject(Supabase);

  @Output() readonly close = new EventEmitter<void>();

  readonly isCheckingAvailability = signal(false);
  readonly availabilityError = signal<string | null>(null);

  closeDialog(): void {
    this.close.emit();
  }

  async goToCheckout(): Promise<void> {
    if (this.isCheckingAvailability() || this.cartService.cartItems().length === 0) {
      return;
    }

    this.isCheckingAvailability.set(true);
    this.availabilityError.set(null);

    try {
      const products = await this.supabase.getProducts();
      const unavailableItems = this.cartService.cartItems().flatMap((item) => {
        const product = products.find((candidate) => candidate.id === item.id);
        const variant = product?.variantPrices.find(
          (candidate) =>
            (candidate.dhotiSize ?? '') === (item.dhotiSize ?? '') &&
            (candidate.dhotiType ?? '') === (item.dhotiType ?? '') &&
            (candidate.shirtSize ?? '') === (item.shirtSize ?? '') &&
            (candidate.sleeveLength ?? '') === (item.sleeveLength ?? ''),
        );

        if (!variant) {
          return [`${item.name} is no longer available in the selected options.`];
        }
        if (variant.quantity < item.quantity) {
          return [
            `${item.name}: ${item.quantity} in cart, but only ${variant.quantity} available.`,
          ];
        }
        return [];
      });

      if (unavailableItems.length > 0) {
        this.availabilityError.set(
          `${unavailableItems.join(' ')} Update your cart before checkout.`,
        );
        return;
      }

      this.closeDialog();
      await this.router.navigate(['/checkout']);
    } catch (error: unknown) {
      console.error('Failed to validate cart product availability.', error);
      this.availabilityError.set('Could not check product availability. Please try again.');
    } finally {
      this.isCheckingAvailability.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeDialog();
  }
}
