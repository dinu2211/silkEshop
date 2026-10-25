import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { Supabase } from '../services/supabase';

import { Conformation } from './conformation';

describe('Conformation', () => {
  let component: Conformation;
  let fixture: ComponentFixture<Conformation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Conformation],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'order-id' } } },
        },
        {
          provide: Supabase,
          useValue: {
            getOrderPaymentStatus: jasmine.createSpy('getOrderPaymentStatus').and.resolveTo({
              id: 'order-id',
              status: 'confirmed',
              paymentStatus: 'paid',
              subtotal: 1200,
              shippingFee: 100,
              total: 1300,
              paymentId: 'payment-id',
            }),
          },
        },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Conformation);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the paid order after loading the payment status', async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Thank you for your order');
    expect(fixture.nativeElement.textContent).toContain('Paid');
  });
});
