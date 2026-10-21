import { CurrencyPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule, type NgForm } from '@angular/forms';
import { MatIcon } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { CartService } from '../cart-service';

interface ShippingDetails {
  fullName: string;
  phone: string;
  email: string;
  address: string;
  apartment: string;
  city: string;
  state: string;
  postalCode: string;
  note: string;
}

@Component({
  selector: 'app-checkout',
  imports: [CurrencyPipe, FormsModule, MatIcon, RouterLink],
  templateUrl: './checkout.html',
  styleUrl: './checkout.scss',
})
export class Checkout {
  readonly cartService = inject(CartService);
  readonly shippingDetails: ShippingDetails = {
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

  private readonly whatsappNumber = '917418758951';

  sendOrderToWhatsApp(form: NgForm): void {
    if (form.invalid || this.cartService.cartItems().length === 0) {
      form.form.markAllAsTouched();
      return;
    }

    const items = this.cartService
      .cartItems()
      .map((item) => {
        const options = [
          item.dhotiSize ? `Dhoti: ${item.dhotiSize}` : '',
          item.shirtSize ? `Shirt: ${item.shirtSize}` : '',
          item.sleeveLength ?? '',
        ]
          .filter(Boolean)
          .join(', ');
        return `• ${item.name}${options ? ` (${options})` : ''} x ${item.quantity} — ₹${item.price * item.quantity}`;
      })
      .join('\n');
    const { fullName, phone, email, address, apartment, city, state, postalCode, note } =
      this.shippingDetails;
    const message = [
      'Hello! I would like to place this order:',
      '',
      items,
      '',
      `Order subtotal: ₹${this.cartService.totalPrice()}`,
      'Shipping: Please confirm',
      '',
      'Shipping details:',
      `Name: ${fullName}`,
      `Phone: +91 ${phone}`,
      ...(email ? [`Email: ${email}`] : []),
      `Address: ${[address, apartment, city, state, postalCode, 'India'].filter(Boolean).join(', ')}`,
      ...(note ? [`Delivery note: ${note}`] : []),
      '',
      'Please confirm the final amount and share the payment options.',
    ].join('\n');

    window.open(
      `https://wa.me/${this.whatsappNumber}?text=${encodeURIComponent(message)}`,
      '_blank',
      'noopener,noreferrer',
    );
  }
}
