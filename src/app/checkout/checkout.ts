import { CurrencyPipe } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIcon } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../cart-service';
import {
  Supabase,
  type OrderCustomer,
  type PromoValidation,
  type RazorpayPaymentResponse,
} from '../services/supabase';

interface PostalAddress {
  city: string;
  state: string;
  country: string;
}

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
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  readonly shippingFee = 100;
  readonly shippingDetails: OrderCustomer = {
    fullName: '',
    phone: '',
    whatsappOptIn: false,
    email: '',
    address: '',
    apartment: '',
    city: '',
    state: '',
    country: '',
    postalCode: '',
    note: '',
  };

  isPostalAddressPrefilled = false;
  isLookingUpPostalCode = false;
  postalLookupError = '';
  isSubmitting = false;
  submissionError = '';
  promoCode = '';
  appliedPromo: PromoValidation | null = null;
  promoError = '';
  isApplyingPromo = false;
  private postalLookupRequest = 0;
  private orderId: string | null = null;
  unverifiedPayment: RazorpayPaymentResponse | null = null;
  private razorpayScript: Promise<void> | null = null;

  get discountAmount(): number {
    if (!this.appliedPromo) {
      return 0;
    }

    const subtotal = this.cartService.totalPrice();
    const discount =
      this.appliedPromo.discountType === 'percentage'
        ? Math.round((subtotal * this.appliedPromo.discountValue) / 100 * 100) / 100
        : this.appliedPromo.discountValue;
    return Math.min(subtotal, discount);
  }

  get totalDue(): number {
    return Math.max(0, this.cartService.totalPrice() - this.discountAmount) + this.shippingFee;
  }

  async applyPromo(): Promise<void> {
    const code = this.promoCode.trim();
    this.promoError = '';
    this.appliedPromo = null;
    if (!code) {
      this.promoError = 'Enter a promo code to apply your discount.';
      return;
    }

    this.isApplyingPromo = true;
    try {
      const promo = await this.supabase.validatePromoCode(
        code,
        this.cartService.totalPrice(),
      );
      this.appliedPromo = promo;
      this.promoCode = promo.code;
    } catch (error: unknown) {
      console.error('Failed to apply checkout promo code.', error);
      this.promoError = 'That promo code is invalid or inactive. Check the code and try again.';
    } finally {
      this.isApplyingPromo = false;
    }
  }

  removePromo(): void {
    this.appliedPromo = null;
    this.promoCode = '';
    this.promoError = '';
  }

  async onPostalCodeChange(postalCode: string): Promise<void> {
    const request = ++this.postalLookupRequest;
    this.isLookingUpPostalCode = false;
    this.isPostalAddressPrefilled = false;
    this.postalLookupError = '';
    this.shippingDetails.city = '';
    this.shippingDetails.state = '';
    this.shippingDetails.country = '';

    if (!/^[0-9]{6}$/.test(postalCode)) {
      return;
    }

    this.isLookingUpPostalCode = true;
    try {
      const response = await fetch(
        `https://api.postalpincode.in/pincode/${encodeURIComponent(postalCode)}`,
      );
      if (!response.ok) {
        throw new Error(`PIN code lookup returned HTTP ${response.status}.`);
      }

      const address = this.parsePostalAddress(await response.json());
      if (!address) {
        throw new Error('PIN code lookup did not return a valid postal address.');
      }
      if (request !== this.postalLookupRequest) {
        return;
      }

      this.shippingDetails.city = address.city;
      this.shippingDetails.state = address.state;
      this.shippingDetails.country = address.country;
      this.isPostalAddressPrefilled = true;
    } catch (error: unknown) {
      if (request !== this.postalLookupRequest) {
        return;
      }
      console.error('Failed to look up the shipping address for the PIN code.', error);
      this.postalLookupError =
        'We could not find this PIN code. Enter your city, state, and country manually.';
    } finally {
      if (request === this.postalLookupRequest) {
        this.isLookingUpPostalCode = false;
        this.changeDetectorRef.detectChanges();
      }
    }
  }

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
          this.appliedPromo?.code,
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

  private parsePostalAddress(value: unknown): PostalAddress | null {
    if (!Array.isArray(value) || value.length === 0 || !this.isRecord(value[0])) {
      return null;
    }

    const result = value[0];
    if (result['Status'] !== 'Success' || !Array.isArray(result['PostOffice'])) {
      return null;
    }

    const office = result['PostOffice'].find((item: unknown) => this.isRecord(item));
    if (!this.isRecord(office)) {
      return null;
    }

    const city = office['District'];
    const state = office['State'];
    const country = office['Country'];
    if (
      typeof city !== 'string' ||
      typeof state !== 'string' ||
      typeof country !== 'string' ||
      !city.trim() ||
      !state.trim() ||
      !country.trim()
    ) {
      return null;
    }

    return { city: city.trim(), state: state.trim(), country: country.trim() };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
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