import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { Supabase, type OrderTrackingDetails } from '../services/supabase';
import { Track } from './track';

describe('Track', () => {
  let fixture: ComponentFixture<Track>;
  let component: Track;
  let getOrderTrackingDetails: jasmine.Spy;

  const order: OrderTrackingDetails = {
    id: 'order-id',
    status: 'confirmed',
    paymentStatus: 'paid',
    createdAt: '2026-10-26T10:00:00Z',
    subtotal: 1200,
    shippingFee: 100,
    total: 1300,
    items: [
      {
        productName: 'Silk Dhoti',
        quantity: 1,
        unitPrice: 1200,
        lineTotal: 1200,
        dhotiSize: '2m',
        shirtSize: null,
        sleeveLength: null,
      },
    ],
    events: [
      {
        id: 'event-id',
        status: 'confirmed',
        title: 'Confirmed',
        description: 'Your order is being prepared.',
        location: null,
        createdAt: '2026-10-26T10:30:00Z',
      },
    ],
  };

  beforeEach(async () => {
    getOrderTrackingDetails = jasmine
      .createSpy('getOrderTrackingDetails')
      .and.resolveTo([order]);

    await TestBed.configureTestingModule({
      imports: [Track],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: () => null } } },
        },
        {
          provide: Supabase,
          useValue: { getOrderTrackingDetails },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Track);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the order timeline and summary after an order-number lookup', async () => {
    component.orderId = ' order-id ';

    await component.trackOrder();
    fixture.detectChanges();

    expect(getOrderTrackingDetails).toHaveBeenCalledOnceWith('order-id', '');
    expect(fixture.nativeElement.textContent).toContain('Tracking history');
    expect(fixture.nativeElement.textContent).toContain('Your order is being prepared.');
    expect(fixture.nativeElement.textContent).toContain('Silk Dhoti');
    expect(fixture.nativeElement.textContent).toContain('₹1,300');
  });

  it('lists multiple orders found by mobile number in separate accordion panels', async () => {
    getOrderTrackingDetails.and.resolveTo([
      order,
      { ...order, id: 'second-order-id', status: 'shipped' },
    ]);
    component.phone = ' 9876543210 ';

    await component.trackOrder();
    fixture.detectChanges();

    expect(getOrderTrackingDetails).toHaveBeenCalledOnceWith('', '9876543210');
    expect(fixture.nativeElement.textContent).toContain('2 orders found');
    expect(fixture.nativeElement.textContent).toContain('Order order-id');
    expect(fixture.nativeElement.textContent).toContain('Order second-order-id');
    expect(fixture.nativeElement.querySelectorAll('.order-accordion').length).toBe(2);
  });

  it('requires at least one lookup value', async () => {
    await component.trackOrder();

    expect(getOrderTrackingDetails).not.toHaveBeenCalled();
    expect(component.errorMessage).toContain('Enter an order number or your checkout mobile number.');
  });

  it('limits the mobile number to 10 digits', () => {
    const input = fixture.nativeElement.querySelector('input[name="phone"]') as HTMLInputElement;
    input.value = '987abc6543210';
    input.dispatchEvent(new Event('input'));

    expect(input.value).toBe('9876543210');
    expect(component.phone).toBe('9876543210');
  });

  it('shows a not-found message when no order matches the lookup', async () => {
    getOrderTrackingDetails.and.resolveTo([]);
    component.orderId = 'order-id';
    component.phone = '9876543210';

    await component.trackOrder();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('We couldn’t find any orders matching those details.');
  });
});
