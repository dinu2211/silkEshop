create table public.order_tracking_details (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  status text not null
    check (status in ('pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'fulfilled', 'cancelled')),
  title text not null check (btrim(title) <> ''),
  description text,
  location text,
  created_at timestamptz not null default now()
);

create index order_tracking_details_order_created_idx
  on public.order_tracking_details (order_id, created_at, id);

alter table public.order_tracking_details enable row level security;
revoke all on table public.order_tracking_details from public, anon, authenticated;

insert into public.order_tracking_details (order_id, status, title, description, created_at)
select
  id,
  status,
  case
    when status = 'pending' then 'Order placed'
    else initcap(status)
  end,
  'Tracking started for this order.',
  created_at
from public.orders;

create or replace function public.add_initial_order_tracking_detail()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.order_tracking_details (order_id, status, title, description, created_at)
  values (
    new.id,
    'pending',
    'Order placed',
    'Your order has been received and is awaiting confirmation.',
    new.created_at
  );

  return new;
end;
$$;

create trigger orders_add_initial_tracking_detail
after insert on public.orders
for each row execute function public.add_initial_order_tracking_detail();

create or replace function public.add_order_status_tracking_detail()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    insert into public.order_tracking_details (order_id, status, title, description)
    values (
      new.id,
      new.status,
      initcap(replace(new.status, '_', ' ')),
      'Your order status has been updated.'
    );
  end if;

  return new;
end;
$$;

create trigger orders_add_status_tracking_detail
after update of status on public.orders
for each row execute function public.add_order_status_tracking_detail();

create or replace function public.get_order_tracking_details(
  order_id_input text,
  phone_input text
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', orders.id,
    'status', coalesce(
      (
        select tracking.status
        from public.order_tracking_details as tracking
        where tracking.order_id = orders.id
        order by tracking.created_at desc, tracking.id desc
        limit 1
      ),
      orders.status
    ),
    'paymentStatus', orders.payment_status,
    'createdAt', orders.created_at,
    'subtotal', orders.subtotal,
    'shippingFee', orders.shipping_fee,
    'total', orders.subtotal + orders.shipping_fee,
    'items', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'productName', order_items.product_name,
            'quantity', order_items.quantity,
            'unitPrice', order_items.unit_price,
            'lineTotal', order_items.line_total,
            'dhotiSize', order_items.dhoti_size,
            'shirtSize', order_items.shirt_size,
            'sleeveLength', order_items.sleeve_length
          )
          order by order_items.id
        ),
        '[]'::jsonb
      )
      from public.order_items
      where order_items.order_id = orders.id
    ),
    'events', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', tracking.id,
            'status', tracking.status,
            'title', tracking.title,
            'description', tracking.description,
            'location', tracking.location,
            'createdAt', tracking.created_at
          )
          order by tracking.created_at, tracking.id
        ),
        '[]'::jsonb
      )
      from public.order_tracking_details as tracking
      where tracking.order_id = orders.id
    )
  )
  from public.orders
  where nullif(btrim(order_id_input), '') is not null
    and nullif(btrim(phone_input), '') is not null
    and orders.id::text = btrim(order_id_input)
    and btrim(orders.phone) = btrim(phone_input);
$$;

revoke all on function public.add_initial_order_tracking_detail() from public, anon, authenticated;
revoke all on function public.add_order_status_tracking_detail() from public, anon, authenticated;
revoke all on function public.get_order_tracking_details(text, text) from public;
grant execute on function public.get_order_tracking_details(text, text) to anon, authenticated;
