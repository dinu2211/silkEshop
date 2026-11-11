import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { CartService } from '../cart-service';
import { Supabase } from '../services/supabase';

import { Checkout } from './checkout';

describe('Checkout', () => {
  let component: Checkout;
  let fixture: ComponentFixture<Checkout>;
  let createOrder: jasmine.Spy;
  let createPaymentOrder: jasmine.Spy;
  let validatePromoCode: jasmine.Spy;

  beforeEach(async () => {
    createOrder = jasmine.createSpy('createOrder').and.resolveTo('order-id');
    createPaymentOrder = jasmine.createSpy('createPaymentOrder').and.resolveTo({
      keyId: 'test-key',
      razorpayOrderId: 'razorpay-order-id',
      amount: 10000,
      currency: 'INR',
    });
    validatePromoCode = jasmine.createSpy('validatePromoCode').and.resolveTo({
      code: 'WEAVE10',
      discountType: 'percentage',
      discountValue: 10,
      discountAmount: 120,
    });

    await TestBed.configureTestingModule({
      imports: [Checkout],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: Supabase,
          useValue: {
            getProducts: jasmine.createSpy('getProducts').and.resolveTo([]),
            createOrder,
            createPaymentOrder,
            validatePromoCode,
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

  it('prefills and disables city, state, and country from the PIN code', async () => {
    TestBed.inject(CartService).cartItems.set([
      { id: 'product-1', name: 'Silk Dhoti', price: 1200, quantity: 1 },
    ]);
    fixture.detectChanges();
    spyOn(window, 'fetch').and.resolveTo(
      new Response(
        JSON.stringify([
          {
            Status: 'Success',
            PostOffice: [{ District: 'Chennai', State: 'Tamil Nadu', Country: 'India' }],
          },
        ]),
        { status: 200 },
      ),
    );

    await component.onPostalCodeChange('600001');

    expect(component.shippingDetails.city).toBe('Chennai');
    expect(component.shippingDetails.state).toBe('Tamil Nadu');
    expect(component.shippingDetails.country).toBe('India');
    expect(component.isPostalAddressPrefilled).toBeTrue();
    expect(component.isLookingUpPostalCode).toBeFalse();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[name="city"]').disabled).toBeTrue();
    expect(fixture.nativeElement.querySelector('[name="state"]').disabled).toBeTrue();
    expect(fixture.nativeElement.querySelector('[name="country"]').disabled).toBeTrue();
  });

  it('clears and unlocks the address fields when the PIN code changes', async () => {
    spyOn(window, 'fetch').and.resolveTo(
      new Response(
        JSON.stringify([
          {
            Status: 'Success',
            PostOffice: [{ District: 'Chennai', State: 'Tamil Nadu', Country: 'India' }],
          },
        ]),
        { status: 200 },
      ),
    );
    await component.onPostalCodeChange('600001');

    await component.onPostalCodeChange('60000');

    expect(component.shippingDetails.city).toBe('');
    expect(component.shippingDetails.state).toBe('');
    expect(component.shippingDetails.country).toBe('');
    expect(component.isPostalAddressPrefilled).toBeFalse();
    expect(component.isLookingUpPostalCode).toBeFalse();
  });

  it('allows manual address entry when PIN code lookup fails', async () => {
    spyOn(window, 'fetch').and.rejectWith(new Error('Network unavailable'));
    spyOn(console, 'error');

    await component.onPostalCodeChange('600001');

    expect(component.postalLookupError).toContain('Enter your city, state, and country manually');
    expect(component.isPostalAddressPrefilled).toBeFalse();
    expect(component.isLookingUpPostalCode).toBeFalse();
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
    component.hasAcceptedTerms = true;
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

  it('applies a validated promo and sends the code with the order', async () => {
    TestBed.inject(CartService).cartItems.set([
      { id: 'product-1', name: 'Silk Dhoti', price: 1200, quantity: 1 },
    ]);
    component.promoCode = ' weave10 ';
    await component.applyPromo();

    expect(validatePromoCode).toHaveBeenCalledOnceWith('weave10', 1200);
    expect(component.appliedPromo?.code).toBe('WEAVE10');
    expect(component.discountAmount).toBe(120);
    expect(component.totalDue).toBe(1180);

    component.hasAcceptedTerms = true;
    createPaymentOrder.and.rejectWith(new Error('Payment service unavailable'));
    spyOn(console, 'error');
    await component.startPayment({
      invalid: false,
      form: { markAllAsTouched: jasmine.createSpy('markAllAsTouched') },
    });

    expect(createOrder).toHaveBeenCalledWith(
      jasmine.objectContaining({ fullName: '' }),
      jasmine.any(Array),
      'WEAVE10',
    );
    expect(component.isSubmitting).toBeFalse();
  });

  it('requires terms acceptance before starting payment', async () => {
    TestBed.inject(CartService).cartItems.set([
      { id: 'product-1', name: 'Silk Dhoti', price: 1200, quantity: 1 },
    ]);
    const form = {
      invalid: false,
      form: { markAllAsTouched: jasmine.createSpy('markAllAsTouched') },
    };

    await component.startPayment(form);

    expect(form.form.markAllAsTouched).toHaveBeenCalled();
    expect(component.submissionError).toContain('accept the Terms and Conditions');
    expect(createOrder).not.toHaveBeenCalled();
    expect(createPaymentOrder).not.toHaveBeenCalled();
  });

});
