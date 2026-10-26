import { CurrencyPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIcon } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../cart-service';
import {
  Supabase,
  type OrderCustomer,
  type RazorpayPaymentResponse,
} from '../services/supabase';

interface CheckoutForm {
  invalid: boolean | null;
  form: {
    markAllAsTouched(): void;
  };
}

@Component({
  selector: 'app-checkout',
  imports: [CurrencyPipe, FormsModule, MatIcon, RouterLink],
  templateUrl: './checkout.html',
  styleUrl: './checkout.scss',
})
export class Checkout {
  readonly cartService = inject(CartService);
  private readonly supabase = inject(Supabase);
  private readonly router = inject(Router);
  readonly shippingFee = 100;
  readonly shippingDetails: OrderCustomer = {
    fullName: '',
    phone: '',
    email: '',
    address: '',
    apartment: '',
    city: '',
    state: '',
    postalCode: '',
    note: '',
  };

  isSubmitting = false;
  submissionError = '';
  private orderId: string | null = null;
  unverifiedPayment: RazorpayPaymentResponse | null = null;
  private razorpayScript: Promise<void> | null = null;

  async startPayment(form: CheckoutForm): Promise<void> {
    if (form.invalid || this.cartService.cartItems().length === 0) {
      form.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.submissionError = '';
    try {
      if (this.unverifiedPayment && this.orderId) {
        await this.verifyPayment(this.unverifiedPayment, this.orderId);
        return;
      }

      if (!this.orderId) {
        this.orderId = await this.supabase.createOrder(
          { ...this.shippingDetails },
          this.cartService.cartItems(),
        );
      }

      const orderId = this.orderId;
      if (!orderId) {
        throw new Error('Order creation did not return an order ID.');
      }
      const paymentOrder = await this.supabase.createPaymentOrder(orderId);
      await this.loadRazorpay();

      const checkout = new window.Razorpay({
        key: paymentOrder.keyId,
        amount: paymentOrder.amount,
        currency: paymentOrder.currency,
        name: 'Weave Made',
        description: 'Order payment',
        order_id: paymentOrder.razorpayOrderId,
        prefill: {
          name: this.shippingDetails.fullName,
          email: this.shippingDetails.email,
          contact: this.shippingDetails.phone,
        },
        theme: { color: '#817044' },
        handler: (response) => {
          void this.verifyPayment(response, orderId);
        },
        modal: {
          ondismiss: () => {
            this.isSubmitting = false;
          },
        },
      });
      checkout.on('payment.failed', (response) => {
        this.submissionError = response.error.description || 'Payment failed. Please try again.';
        this.isSubmitting = false;
      });
      checkout.open();
    } catch (error) {
      console.error('Failed to start Razorpay checkout.', error);
      this.submissionError = 'We could not start your payment. Please try again.';
      this.isSubmitting = false;
    }
  }

  private async verifyPayment(
    response: RazorpayPaymentResponse,
    orderId: string,
  ): Promise<void> {
    this.isSubmitting = true;
    this.unverifiedPayment = response;
    this.submissionError = '';
    try {
      await this.supabase.verifyPayment(orderId, response);
      this.unverifiedPayment = null;
      this.cartService.clear();
      await this.router.navigate(['/confirmation', orderId]);
    } catch (error) {
      console.error('Razorpay payment verification failed.', error);
      this.submissionError =
        'Payment was submitted, but we could not verify it yet. Do not pay again; retry verification below.';
      this.isSubmitting = false;
    }
  }

  private loadRazorpay(): Promise<void> {
    if (window.Razorpay) {
      return Promise.resolve();
    }

    if (!this.razorpayScript) {
      this.razorpayScript = new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => {
          this.razorpayScript = null;
          reject(new Error('Razorpay checkout could not be loaded.'));
        };
        document.head.appendChild(script);
      });
    }

    return this.razorpayScript;
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: { name: string; email: string; contact: string };
  theme: { color: string };
  handler: (response: RazorpayPaymentResponse) => void;
  modal: { ondismiss: () => void };
}

interface RazorpayCheckout {
  open(): void;
  on(event: 'payment.failed', handler: (response: { error: { description?: string } }) => void): void;
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayCheckout;
  }
}
// 50vi2ogn73qYAbe4