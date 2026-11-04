import { Injectable } from '@angular/core';
import { createClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import type { CartItem, Product } from '../cart-service';

export type NewProduct = Omit<Product, 'id'> & { id?: string };
export type ProductUpdate = Partial<Omit<Product, 'id'>>;

export interface OrderCustomer {
  fullName: string;
  phone: string;
  whatsappOptIn: boolean;
  email: string;
  address: string;
  apartment: string;
  city: string;
  state: string;
  postalCode: string;
  note: string;
}

export interface RazorpayPaymentResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface PaymentOrder {
  keyId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
}

export interface OrderPaymentStatus {
  id: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'fulfilled';
  paymentStatus: 'pending' | 'paid' | 'failed';
  subtotal: number;
  shippingFee: number;
  total: number;
  paymentId: string | null;
}

export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'out_for_delivery',
  'fulfilled',
  'cancelled',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface AdminOrderStatusUpdateResult {
  status: OrderStatus;
  whatsappSent: boolean;
  whatsappSkipReason?: 'customer_not_opted_in' | 'delivery_failed' | 'not_confirmation';
}

export interface OrderTrackingItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  dhotiSize: string | null;
  shirtSize: string | null;
  sleeveLength: string | null;
}

export type OrderTrackingStatus = OrderStatus;

export interface OrderTrackingEvent {
  id: string;
  status: OrderTrackingStatus;
  title: string;
  description: string | null;
  location: string | null;
  createdAt: string;
}

export interface OrderTrackingDetails {
  id: string;
  status: OrderTrackingStatus;
  paymentStatus: OrderPaymentStatus['paymentStatus'];
  createdAt: string;
  subtotal: number;
  shippingFee: number;
  total: number;
  items: OrderTrackingItem[];
  events: OrderTrackingEvent[];
}

export interface AdminOrder extends Omit<OrderTrackingDetails, 'events'> {
  fullName: string;
  phone: string;
  email: string | null;
  address: string;
  apartment: string | null;
  city: string;
  state: string;
  postalCode: string;
  deliveryNote: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && ORDER_STATUSES.some((status) => status === value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isProductVariant(value: unknown): value is Product['variantPrices'][number] {
  return (
    isRecord(value) &&
    typeof value['price'] === 'number' &&
    Number.isSafeInteger(value['price']) &&
    value['price'] >= 0 &&
    typeof value['quantity'] === 'number' &&
    Number.isSafeInteger(value['quantity']) &&
    value['quantity'] >= 0 &&
    ['dhotiSize', 'shirtSize', 'sleeveLength', 'dhotiType'].every(
      (key) => value[key] === undefined || typeof value[key] === 'string',
    )
  );
}

function isProduct(value: unknown): value is Product {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['name'] === 'string' &&
    typeof value['description'] === 'string' &&
    Array.isArray(value['imageUrls']) &&
    value['imageUrls'].length >= 1 &&
    value['imageUrls'].length <= 6 &&
    value['imageUrls'].every(
      (imageUrl) => typeof imageUrl === 'string' && imageUrl.trim().length > 0,
    ) &&
    typeof value['category'] === 'string' &&
    isNullableString(value['collection'] ?? null) &&
    isNullableString(value['idealFor'] ?? null) &&
    Array.isArray(value['variantPrices']) &&
    value['variantPrices'].every(isProductVariant)
  );
}

function isOrderTrackingItem(value: unknown): value is OrderTrackingItem {
  return (
    isRecord(value) &&
    typeof value['productName'] === 'string' &&
    typeof value['quantity'] === 'number' &&
    Number.isFinite(value['quantity']) &&
    typeof value['unitPrice'] === 'number' &&
    Number.isFinite(value['unitPrice']) &&
    typeof value['lineTotal'] === 'number' &&
    Number.isFinite(value['lineTotal']) &&
    isNullableString(value['dhotiSize']) &&
    isNullableString(value['shirtSize']) &&
    isNullableString(value['sleeveLength'])
  );
}

function isOrderTrackingEvent(value: unknown): value is OrderTrackingEvent {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    isOrderStatus(value['status']) &&
    typeof value['title'] === 'string' &&
    isNullableString(value['description']) &&
    isNullableString(value['location']) &&
    typeof value['createdAt'] === 'string'
  );
}

function isOrderTrackingDetails(value: unknown): value is OrderTrackingDetails {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    isOrderStatus(value['status']) &&
    (value['paymentStatus'] === 'pending' ||
      value['paymentStatus'] === 'paid' ||
      value['paymentStatus'] === 'failed') &&
    typeof value['createdAt'] === 'string' &&
    typeof value['subtotal'] === 'number' &&
    Number.isFinite(value['subtotal']) &&
    typeof value['shippingFee'] === 'number' &&
    Number.isFinite(value['shippingFee']) &&
    typeof value['total'] === 'number' &&
    Number.isFinite(value['total']) &&
    Array.isArray(value['items']) &&
    value['items'].every(isOrderTrackingItem) &&
    Array.isArray(value['events']) &&
    value['events'].every(isOrderTrackingEvent)
  );
}

function isAdminOrder(value: unknown): value is AdminOrder {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    isOrderStatus(value['status']) &&
    (value['paymentStatus'] === 'pending' ||
      value['paymentStatus'] === 'paid' ||
      value['paymentStatus'] === 'failed') &&
    typeof value['createdAt'] === 'string' &&
    typeof value['subtotal'] === 'number' &&
    Number.isFinite(value['subtotal']) &&
    typeof value['shippingFee'] === 'number' &&
    Number.isFinite(value['shippingFee']) &&
    typeof value['total'] === 'number' &&
    Number.isFinite(value['total']) &&
    Array.isArray(value['items']) &&
    value['items'].every(isOrderTrackingItem) &&
    typeof value['fullName'] === 'string' &&
    typeof value['phone'] === 'string' &&
    isNullableString(value['email']) &&
    typeof value['address'] === 'string' &&
    isNullableString(value['apartment']) &&
    typeof value['city'] === 'string' &&
    typeof value['state'] === 'string' &&
    typeof value['postalCode'] === 'string' &&
    isNullableString(value['deliveryNote'])
  );
}

@Injectable({
  providedIn: 'root',
})
export class Supabase {
  private readonly client = createClient(environment.supabaseUrl, environment.supabaseKey);
  private readonly table = 'products';
  private readonly adminSessionStorageKey = 'silk-eshop-admin-session';

  async isOrderAdminSignedIn(): Promise<boolean> {
    const sessionToken = this.getAdminSessionToken();
    if (!sessionToken) {
      return false;
    }

    const { data, error } = await this.client.rpc('admin_session_is_valid', {
      session_token_input: sessionToken,
    });

    if (error) {
      throw error;
    }

    if (data !== true) {
      sessionStorage.removeItem(this.adminSessionStorageKey);
      return false;
    }

    return true;
  }

  async signInOrderAdmin(userId: string, password: string): Promise<void> {
    const { data, error } = await this.client.rpc('admin_login', {
      user_id_input: userId.trim(),
      password_input: password,
    });

    if (error) {
      throw error;
    }

    if (isRecord(data) && typeof data['error'] === 'string') {
      throw new Error(data['error']);
    }

    if (
      !isRecord(data) ||
      typeof data['sessionToken'] !== 'string' ||
      typeof data['expiresAt'] !== 'string' ||
      Date.parse(data['expiresAt']) <= Date.now()
    ) {
      throw new Error('Administrator sign-in did not return a valid session.');
    }

    sessionStorage.setItem(this.adminSessionStorageKey, data['sessionToken']);
  }

  async signOutOrderAdmin(): Promise<void> {
    const sessionToken = this.getAdminSessionToken();
    if (!sessionToken) {
      return;
    }

    const { error } = await this.client.rpc('admin_logout', {
      session_token_input: sessionToken,
    });

    if (error) {
      throw error;
    }

    sessionStorage.removeItem(this.adminSessionStorageKey);
  }

  async getAdminOrders(): Promise<AdminOrder[]> {
    const { data, error } = await this.client.rpc('get_admin_orders', {
      session_token_input: this.requireAdminSessionToken(),
    });

    if (error) {
      throw error;
    }

    if (!Array.isArray(data) || !data.every(isAdminOrder)) {
      throw new Error('Order management lookup did not return valid order details.');
    }

    return data;
  }

  async getAdminProducts(): Promise<Product[]> {
    const { data, error } = await this.client.rpc('get_admin_products', {
      session_token_input: this.requireAdminSessionToken(),
    });

    if (error) {
      throw error;
    }

    if (!Array.isArray(data) || !data.every(isProduct)) {
      throw new Error('Product management lookup did not return valid product details.');
    }

    return data;
  }

  async uploadProductImages(files: File[]): Promise<string[]> {
    if (files.length === 0 || files.length > 6) {
      throw new Error('Choose between one and six product images to upload.');
    }

    const body = new FormData();
    body.set('sessionToken', this.requireAdminSessionToken());
    for (const file of files) {
      body.append('images', file, file.name);
    }

    const { data, error } = await this.client.functions.invoke<{ imageUrls: unknown }>(
      'manage-product-images',
      { body },
    );
    if (error) {
      throw error;
    }
    if (
      !data ||
      !Array.isArray(data.imageUrls) ||
      data.imageUrls.length !== files.length ||
      !data.imageUrls.every((imageUrl) => typeof imageUrl === 'string')
    ) {
      throw new Error('Image upload did not return valid public image URLs.');
    }

    return data.imageUrls;
  }

  async deleteProductImages(imageUrls: string[]): Promise<void> {
    if (imageUrls.length === 0) {
      return;
    }
    const body = {
      action: 'delete',
      sessionToken: this.requireAdminSessionToken(),
      imageUrls,
    };
    const { error } = await this.client.functions.invoke('manage-product-images', { body });
    if (error) {
      throw error;
    }
  }

  async updateAdminOrderStatus(
    orderId: string,
    status: OrderStatus,
  ): Promise<AdminOrderStatusUpdateResult> {
    const { data, error } = await this.client.functions.invoke<AdminOrderStatusUpdateResult>(
      'update-admin-order-status',
      {
        body: {
          orderId,
          status,
          sessionToken: this.requireAdminSessionToken(),
        },
      },
    );

    if (error) {
      throw error;
    }

    if (!data || data.status !== status) {
      throw new Error('Order status update did not return the requested status.');
    }

    return data;
  }

  private getAdminSessionToken(): string | null {
    if (typeof sessionStorage === 'undefined') {
      return null;
    }

    return sessionStorage.getItem(this.adminSessionStorageKey);
  }

  private requireAdminSessionToken(): string {
    const sessionToken = this.getAdminSessionToken();
    if (!sessionToken) {
      throw new Error('Administrator sign-in is required.');
    }

    return sessionToken;
  }

  async createOrder(customer: OrderCustomer, items: CartItem[]): Promise<string> {
    const { data, error } = await this.client.rpc('create_order', {
      order_data: {
        customer: {
          full_name: customer.fullName,
          phone: customer.phone,
          whatsapp_opt_in: customer.whatsappOptIn,
          email: customer.email || null,
          address: customer.address,
          apartment: customer.apartment || null,
          city: customer.city,
          state: customer.state,
          postal_code: customer.postalCode,
          delivery_note: customer.note || null,
        },
        items: items.map((item) => ({
          product_id: item.id,
          product_name: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          dhoti_size: item.dhotiSize ?? null,
          shirt_size: item.shirtSize ?? null,
          sleeve_length: item.sleeveLength ?? null,
        })),
      },
    });

    if (error) {
      throw error;
    }

    if (typeof data !== 'string') {
      throw new Error('Order creation did not return an order ID.');
    }

    return data;
  }

  async createPaymentOrder(orderId: string): Promise<PaymentOrder> {
    const { data, error } = await this.client.functions.invoke<PaymentOrder>(
      'create-razorpay-order',
      { body: { orderId } },
    );

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error('Payment order creation did not return payment details.');
    }

    return data;
  }

  async verifyPayment(
    orderId: string,
    payment: RazorpayPaymentResponse,
  ): Promise<OrderPaymentStatus> {
    const { data, error } = await this.client.functions.invoke<OrderPaymentStatus>(
      'verify-razorpay-payment',
      {
        body: {
          orderId,
          razorpayOrderId: payment.razorpay_order_id,
          razorpayPaymentId: payment.razorpay_payment_id,
          razorpaySignature: payment.razorpay_signature,
        },
      },
    );

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error('Payment verification did not return an order status.');
    }

    return data;
  }

  async getOrderPaymentStatus(orderId: string): Promise<OrderPaymentStatus> {
    const { data, error } = await this.client.functions.invoke<OrderPaymentStatus>(
      'get-order-payment-status',
      { body: { orderId } },
    );

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error('Order status lookup did not return an order.');
    }

    return data;
  }

  async getOrderTrackingDetails(
    orderId: string,
    phone: string,
  ): Promise<OrderTrackingDetails[]> {
    const { data, error } = await this.client
      .rpc('get_order_tracking_details', {
        order_id_input: orderId.trim() || null,
        phone_input: phone.trim() || null,
      });

    if (error) {
      throw error;
    }

    if (!Array.isArray(data) || !data.every(isOrderTrackingDetails)) {
      throw new Error('Order tracking lookup did not return valid order details.');
    }

    return data;
  }

  async getProducts(): Promise<Product[]> {
    const { data, error } = await this.client.from(this.table).select('*');

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  async getProductById(id: string): Promise<Product> {
    const { data, error } = await this.client.from(this.table).select('*').eq('id', id).maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error(`Product with id "${id}" was not found.`);
    }

    return data;
  }

  async createProduct(product: NewProduct): Promise<Product> {
    return this.saveAdminProduct(product);
  }

  async updateProduct(id: string, updates: ProductUpdate): Promise<Product> {
    if (Object.keys(updates).length === 0) {
      throw new Error('At least one product field must be provided for an update.');
    }

    return this.saveAdminProduct({ ...updates, id });
  }

  private async saveAdminProduct(
    product: NewProduct | (ProductUpdate & { id: string }),
  ): Promise<Product> {
    const { data, error } = await this.client.rpc('save_admin_product', {
      product_data: product,
      session_token_input: this.requireAdminSessionToken(),
    });

    if (error) {
      throw error;
    }

    if (!isProduct(data)) {
      throw new Error('Product save did not return a valid product record.');
    }

    return data;
  }

  async deleteProduct(id: string): Promise<void> {
    const { error } = await this.client.from(this.table).delete().eq('id', id);

    if (error) {
      throw error;
    }
  }
}
