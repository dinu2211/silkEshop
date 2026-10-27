import { CurrencyPipe, DatePipe, isPlatformBrowser, TitleCasePipe } from '@angular/common';
import { Component, computed, inject, PLATFORM_ID, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ORDER_STATUSES,
  Supabase,
  type AdminOrder,
  type OrderStatus,
} from '../services/supabase';

type OrderFilter = OrderStatus | 'all';

const nextOrderStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'confirmed',
  confirmed: 'processing',
  processing: 'shipped',
  shipped: 'out_for_delivery',
  out_for_delivery: 'fulfilled',
};

@Component({
  selector: 'app-view-order',
  imports: [CurrencyPipe, DatePipe, FormsModule, RouterLink, TitleCasePipe],
  templateUrl: './view-order.html',
  styleUrl: './view-order.scss',
})
export class ViewOrder {
  private readonly supabase = inject(Supabase);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly statuses = ORDER_STATUSES;
  readonly isCheckingSession = signal(true);
  readonly isAdmin = signal(false);
  readonly orders = signal<AdminOrder[]>([]);
  readonly filter = signal<OrderFilter>('pending');
  readonly isLoadingOrders = signal(false);
  readonly isSigningIn = signal(false);
  readonly updatingOrderId = signal<string | null>(null);
  readonly printingOrderId = signal<string | null>(null);
  readonly errorMessage = signal('');
  userId = '';
  password = '';
  readonly filteredOrders = computed(() => {
    const filter = this.filter();
    const orders = this.orders();
    return filter === 'all' ? orders : orders.filter((order) => order.status === filter);
  });
  readonly statusCounts = computed(() => {
    const counts: Record<OrderStatus, number> = {
      pending: 0,
      confirmed: 0,
      processing: 0,
      shipped: 0,
      out_for_delivery: 0,
      fulfilled: 0,
      cancelled: 0,
    };

    for (const order of this.orders()) {
      counts[order.status] += 1;
    }

    return counts;
  });

  constructor() {
    if (this.isBrowser) {
      void this.restoreAdminSession();
    }
  }

  async signIn(): Promise<void> {
    const userId = this.userId.trim();
    const password = this.password;
    if (!userId || !password) {
      this.errorMessage.set('Enter your administrator user ID and password.');
      return;
    }

    this.isSigningIn.set(true);
    this.errorMessage.set('');
    try {
      await this.supabase.signInOrderAdmin(userId, password);
      this.isAdmin.set(true);
      this.password = '';
      await this.loadOrders();
    } catch (error: unknown) {
      console.error('Failed to sign in to order management.', error);
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
      this.orders.set([]);
      this.filter.set('pending');
    } catch (error: unknown) {
      console.error('Failed to sign out of order management.', error);
      this.errorMessage.set('Unable to sign out right now. Please try again.');
    }
  }

  async loadOrders(): Promise<void> {
    this.isLoadingOrders.set(true);
    this.errorMessage.set('');
    try {
      this.orders.set(await this.supabase.getAdminOrders());
    } catch (error: unknown) {
      console.error('Failed to load orders for order management.', error);
      this.errorMessage.set('Orders could not be loaded. Please refresh and try again.');
    } finally {
      this.isLoadingOrders.set(false);
    }
  }

  async updateStatus(order: AdminOrder, status: OrderStatus): Promise<void> {
    if (this.updatingOrderId() !== null) {
      return;
    }

    if (
      status === 'cancelled' &&
      !globalThis.confirm(`Cancel the order for ${order.fullName}?`)
    ) {
      return;
    }

    this.updatingOrderId.set(order.id);
    this.errorMessage.set('');
    try {
      const updatedStatus = await this.supabase.updateAdminOrderStatus(order.id, status);
      this.orders.update((orders) =>
        orders.map((current) =>
          current.id === order.id ? { ...current, status: updatedStatus } : current,
        ),
      );
    } catch (error: unknown) {
      console.error(`Failed to update order ${order.id}.`, error);
      this.errorMessage.set('The order status could not be updated. Refresh and try again.');
    } finally {
      this.updatingOrderId.set(null);
    }
  }

  printDispatchDetails(order: AdminOrder): void {
    if (!this.isBrowser) {
      return;
    }

    this.printingOrderId.set(order.id);
    globalThis.setTimeout(() => {
      try {
        window.print();
      } finally {
        this.printingOrderId.set(null);
      }
    });
  }

  nextStatus(status: OrderStatus): OrderStatus | null {
    return nextOrderStatus[status] ?? null;
  }

  statusLabel(status: OrderStatus): string {
    return status.replaceAll('_', ' ');
  }

  emptyFilterLabel(): string {
    const filter = this.filter();
    if (filter === 'all') {
      return '';
    }

    return `${this.statusLabel(filter)} `;
  }

  private async restoreAdminSession(): Promise<void> {
    try {
      const isAdmin = await this.supabase.isOrderAdminSignedIn();
      this.isAdmin.set(isAdmin);
      if (isAdmin) {
        await this.loadOrders();
      }
    } catch (error: unknown) {
      console.error('Failed to restore order-management session.', error);
      this.errorMessage.set('Unable to verify your sign-in. Please sign in again.');
    } finally {
      this.isCheckingSession.set(false);
    }
  }
}
