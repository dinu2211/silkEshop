import { CurrencyPipe, TitleCasePipe } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIcon } from '@angular/material/icon';
import { OrderPaymentStatus, Supabase } from '../services/supabase';

@Component({
  selector: 'app-conformation',
  imports: [CurrencyPipe, MatIcon, RouterLink, TitleCasePipe],
  templateUrl: './conformation.html',
  styleUrl: './conformation.scss',
})
export class Conformation implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly supabase = inject(Supabase);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly orderId = this.route.snapshot.paramMap.get('orderId');

  order: OrderPaymentStatus | null = null;
  isLoading = true;
  errorMessage = '';

  ngOnInit(): void {
    void this.loadOrder();
  }

  async loadOrder(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';
    if (!this.orderId) {
      this.errorMessage = 'The order number is missing from this link.';
      this.isLoading = false;
      this.changeDetector.markForCheck();
      return;
    }

    try {
      this.order = await this.supabase.getOrderPaymentStatus(this.orderId);
    } catch (error) {
      console.error('Failed to load order status.', error);
      this.errorMessage = 'Please check your connection and try again.';
    } finally {
      this.isLoading = false;
      this.changeDetector.markForCheck();
    }
  }
}
