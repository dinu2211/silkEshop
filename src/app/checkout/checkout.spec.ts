import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CartService } from '../cart-service';
import { Supabase } from '../services/supabase';

import { Checkout } from './checkout';

describe('Checkout', () => {
  let component: Checkout;
  let fixture: ComponentFixture<Checkout>;
  let createOrder: jasmine.Spy;
  let createPaymentOrder: jasmine.Spy;

  beforeEach(async () => {
    createOrder = jasmine.createSpy('createOrder').and.resolveTo('order-id');
    createPaymentOrder = jasmine.createSpy('createPaymentOrder').and.resolveTo({
      keyId: 'test-key',
      razorpayOrderId: 'razorpay-order-id',
      amount: 10000,
      currency: 'INR',
    });

    await TestBed.configureTestingModule({
      imports: [Checkout],
      providers: [
        provideRouter([]),
        {
          provide: Supabase,
          useValue: {
            getProducts: jasmine.createSpy('getProducts').and.resolveTo([]),
            createOrder,
            createPaymentOrder,
            verifyPayment: jasmine.createSpy('verifyPayment'),
          },
        },
      ],
    })
      .compileComponents();

    fixture = TestBed.createComponent(Checkout);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('requires valid delivery details before creating an order', async () => {
    const cartService = TestBed.inject(CartService);
    cartService.cartItems.set([
      { id: 'product-1', name: 'Silk Dhoti', price: 1200, quantity: 2 },
    ]);
    const form = {
      invalid: true,
      form: { markAllAsTouched: jasmine.createSpy('markAllAsTouched') },
    };

    await component.startPayment(form);

    expect(form.form.markAllAsTouched).toHaveBeenCalled();
    expect(createOrder).not.toHaveBeenCalled();
    expect(createPaymentOrder).not.toHaveBeenCalled();
  });

  it('does not start payment when the order cannot be saved', async () => {
    createOrder.and.callFake(() => Promise.reject(new Error('Supabase unavailable')));
    TestBed.inject(CartService).cartItems.set([
      { id: 'product-1', name: 'Silk Dhoti', price: 1200, quantity: 1 },
    ]);
    spyOn(console, 'error');
    const form = {
      invalid: false,
      form: { markAllAsTouched: jasmine.createSpy('markAllAsTouched') },
    };

    await component.startPayment(form);

    expect(component.submissionError).toContain('could not start your payment');
    expect(createPaymentOrder).not.toHaveBeenCalled();
    expect(component.isSubmitting).toBeFalse();
  });

});
