alter table public.orders
  add column shipping_fee numeric(12, 2) not null default 100
    check (shipping_fee >= 0),
  add column payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed')),
  add column razorpay_order_id text unique,
  add column razorpay_payment_id text;
