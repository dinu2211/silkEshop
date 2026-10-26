import { CurrencyPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIcon } from '@angular/material/icon';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Supabase, type OrderTrackingDetails } from '../services/supabase';

@Component({
  selector: 'app-track',
  imports: [CurrencyPipe, DatePipe, FormsModule, MatIcon, RouterLink, TitleCasePipe],
  templateUrl: './track.html',
  styleUrl: './track.scss',
})
export class Track {
  private readonly route = inject(ActivatedRoute);
  private readonly supabase = inject(Supabase);
  private readonly changeDetector = inject(ChangeDetectorRef);

  orderId = this.route.snapshot.queryParamMap.get('orderId') ?? '';
  phone = '';
  orders: OrderTrackingDetails[] = [];
  isLoading = false;
  errorMessage = '';
  notFound = false;

  onPhoneChange(value: string): void {
    this.phone = value.replace(/\D/g, '').slice(0, 10);
  }

  async trackOrder(): Promise<void> {
    const orderId = this.orderId.trim();
    const phone = this.phone.trim();
    if (!orderId && !phone) {
      this.errorMessage = 'Enter an order number or your checkout mobile number.';
      this.notFound = false;
      this.orders = [];
      return;
    }

    this.isLoading = true;
    this.orders = [];
    this.errorMessage = '';
    this.notFound = false;
    try {
      this.orders = await this.supabase.getOrderTrackingDetails(orderId, phone);
      this.notFound = this.orders.length === 0;
    } catch (error) {
      console.error('Failed to load order tracking details.', error);
      this.errorMessage = 'We couldn’t load tracking right now. Please check your connection and retry.';
    } finally {
      this.isLoading = false;
      this.changeDetector.markForCheck();
    }
  }

  trackingIcon(status: string): string {
    switch (status) {
      case 'confirmed':
        return 'inventory_2';
      case 'processing':
        return 'inventory';
      case 'shipped':
        return 'local_shipping';
      case 'out_for_delivery':
        return 'delivery_dining';
      case 'fulfilled':
        return 'check_circle';
      case 'cancelled':
        return 'cancel';
      default:
        return 'shopping_bag';
    }
  }
}
