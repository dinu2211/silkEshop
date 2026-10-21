import { CurrencyPipe } from '@angular/common';
import { Component, EventEmitter, HostListener, inject, Output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { Router } from '@angular/router';
import { CartService } from '../cart-service';

@Component({
  selector: 'app-view-cart',
  imports: [CurrencyPipe, MatIcon],
  templateUrl: './view-cart.html',
  styleUrl: './view-cart.scss',
})
export class ViewCart {
  readonly cartService = inject(CartService);
  private readonly router = inject(Router);

  @Output() readonly close = new EventEmitter<void>();

  closeDialog(): void {
    this.close.emit();
  }

  goToCheckout(): void {
    this.closeDialog();
    void this.router.navigate(['/checkout']);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeDialog();
  }
}
