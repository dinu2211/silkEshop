import { Injectable } from '@angular/core';
import { createClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import type { CartItem, ProductCategory } from '../cart-service';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: ProductCategory;
}

export type NewProduct = Omit<Product, 'id'> & { id?: string };
export type ProductUpdate = Partial<Omit<Product, 'id'>>;

export interface OrderCustomer {
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

export interface OrderTrackingItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  dhotiSize: string | null;
  shirtSize: string | null;
  sleeveLength: string | null;
}

export type OrderTrackingStatus =
  | OrderPaymentStatus['status']
  | 'processing'
  | 'shipped'
  | 'out_for_delivery';

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

const trackingStatuses: readonly string[] = [
  'pending',
  'confirmed',
  'cancelled',
  'fulfilled',
  'processing',
  'shipped',
  'out_for_delivery',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
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
    typeof value['status'] === 'string' &&
    trackingStatuses.includes(value['status']) &&
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
    typeof value['status'] === 'string' &&
    trackingStatuses.includes(value['status']) &&
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

@Injectable({
  providedIn: 'root',
})
export class Supabase {
  private readonly client = createClient(environment.supabaseUrl, environment.supabaseKey);
  private readonly table = 'products';

  async createOrder(customer: OrderCustomer, items: CartItem[]): Promise<string> {
    const { data, error } = await this.client.rpc('create_order', {
      order_data: {
        customer: {
          full_name: customer.fullName,
          phone: customer.phone,
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
    const { id, ...productToInsert } = product;
    const { data, error } = await this.client
      .from(this.table)
      .insert(productToInsert)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error('Product creation did not return a record.');
    }

    return data;
  }

  async updateProduct(id: string, updates: ProductUpdate): Promise<Product> {
    if (Object.keys(updates).length === 0) {
      throw new Error('At least one product field must be provided for an update.');
    }

    const { data, error } = await this.client
      .from(this.table)
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error(`Product with id "${id}" was not found for update.`);
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
