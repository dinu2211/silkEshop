import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Supabase, type AdminOrder } from '../services/supabase';
import { ViewOrder } from './view-order';

describe('ViewOrder', () => {
  let component: ViewOrder;
  let fixture: ComponentFixture<ViewOrder>;
  let supabase: jasmine.SpyObj<Supabase>;

  const pendingOrder: AdminOrder = {
    id: 'pending-order-id',
    status: 'pending',
    paymentStatus: 'pending',
    createdAt: '2026-10-27T10:00:00.000Z',
    subtotal: 1200,
    shippingFee: 100,
    total: 1300,
    items: [],
    fullName: 'A Customer',
    phone: '9876543210',
    email: null,
    address: '1 Market Road',
    apartment: null,
    city: 'Chennai',
    state: 'Tamil Nadu',
    postalCode: '600001',
    deliveryNote: null,
  };
  const confirmedOrder: AdminOrder = {
    ...pendingOrder,
    id: 'confirmed-order-id',
    status: 'confirmed',
  };
  const processingOrder: AdminOrder = {
    ...pendingOrder,
    id: 'processing-order-id',
    status: 'processing',
    apartment: 'Suite 2',
    deliveryNote: 'Call on arrival',
    items: [
      {
        productName: 'Silk Dhoti',
        quantity: 2,
        unitPrice: 1200,
        dhotiSize: 'Free size',
        shirtSize: null,
        sleeveLength: null,
        lineTotal: 2400,
      },
    ],
  };

  beforeEach(async () => {
    supabase = jasmine.createSpyObj<Supabase>('Supabase', [
      'isOrderAdminSignedIn',
      'signInOrderAdmin',
      'signOutOrderAdmin',
      'getAdminOrders',
      'updateAdminOrderStatus',
    ]);
    supabase.isOrderAdminSignedIn.and.resolveTo(true);
    supabase.getAdminOrders.and.resolveTo([pendingOrder, confirmedOrder]);
    supabase.updateAdminOrderStatus.and.callFake(async (_orderId, status) => status);

    await TestBed.configureTestingModule({
      imports: [ViewOrder],
      providers: [{ provide: Supabase, useValue: supabase }],
    }).compileComponents();

    fixture = TestBed.createComponent(ViewOrder);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('should create and show pending orders by default', () => {
    expect(component).toBeTruthy();
    expect(component.filter()).toBe('pending');
    expect(component.filteredOrders()).toEqual([pendingOrder]);
    expect(fixture.nativeElement.textContent).toContain('A Customer');
    expect(fixture.nativeElement.textContent).not.toContain('confirmed-order-id');
  });

  it('filters all orders and counts their status badges', () => {
    component.filter.set('all');
    fixture.detectChanges();

    expect(component.filteredOrders()).toEqual([pendingOrder, confirmedOrder]);
    expect(component.statusCounts()['pending']).toBe(1);
    expect(component.statusCounts()['confirmed']).toBe(1);
  });

  it('advances an order to the requested next status', async () => {
    await component.updateStatus(pendingOrder, 'confirmed');

    expect(supabase.updateAdminOrderStatus).toHaveBeenCalledWith(
      pendingOrder.id,
      'confirmed',
    );
    expect(component.orders()[0].status).toBe('confirmed');
  });

  it('shows courier print details only for orders in processing', () => {
    component.orders.set([pendingOrder, processingOrder]);
    component.filter.set('processing');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.print-button')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.dispatch-slip').textContent).toContain(
      'Call on arrival',
    );
    expect(fixture.nativeElement.querySelector('.dispatch-slip').textContent).toContain(
      'Suite 2',
    );
    expect(fixture.nativeElement.querySelector('.dispatch-slip').textContent).toContain(
      'Qty 2',
    );
    expect(fixture.nativeElement.querySelector('.dispatch-slip').textContent).not.toContain(
      '₹',
    );

    component.filter.set('pending');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.print-button')).toBeNull();
  });

  it('opens the browser print dialog for the selected dispatch slip', fakeAsync(() => {
    const printSpy = spyOn(window, 'print');

    component.printDispatchDetails(processingOrder);
    tick();

    expect(printSpy).toHaveBeenCalled();
    expect(component.printingOrderId()).toBeNull();
  }));
});
