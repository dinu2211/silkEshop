create table public.orders (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (btrim(full_name) <> ''),
  phone text not null check (btrim(phone) <> ''),
  email text,
  address text not null check (btrim(address) <> ''),
  apartment text,
  city text not null check (btrim(city) <> ''),
  state text not null check (btrim(state) <> ''),
  postal_code text not null check (btrim(postal_code) <> ''),
  delivery_note text,
  subtotal numeric(12, 2) not null default 0 check (subtotal >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'cancelled', 'fulfilled')),
  created_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id text not null,
  product_name text not null check (btrim(product_name) <> ''),
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  line_total numeric(14, 2) generated always as (quantity * unit_price) stored,
  dhoti_size text,
  shirt_size text,
  sleeve_length text
);

create index order_items_order_id_idx on public.order_items (order_id);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

revoke all on table public.orders, public.order_items from anon, authenticated;

create or replace function public.create_order(order_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_order_id uuid;
  inserted_item_count integer;
begin
  if jsonb_typeof(order_data) is distinct from 'object'
    or jsonb_typeof(order_data -> 'customer') is distinct from 'object'
    or jsonb_typeof(order_data -> 'items') is distinct from 'array'
  then
    raise exception 'Invalid order data.';
  end if;

  if jsonb_array_length(order_data -> 'items') = 0
    or jsonb_array_length(order_data -> 'items') > 100
  then
    raise exception 'An order must contain between 1 and 100 items.';
  end if;

  insert into public.orders (
    full_name,
    phone,
    email,
    address,
    apartment,
    city,
    state,
    postal_code,
    delivery_note
  )
  values (
    order_data #>> '{customer,full_name}',
    order_data #>> '{customer,phone}',
    nullif(order_data #>> '{customer,email}', ''),
    order_data #>> '{customer,address}',
    nullif(order_data #>> '{customer,apartment}', ''),
    order_data #>> '{customer,city}',
    order_data #>> '{customer,state}',
    order_data #>> '{customer,postal_code}',
    nullif(order_data #>> '{customer,delivery_note}', '')
  )
  returning id into new_order_id;

  insert into public.order_items (
    order_id,
    product_id,
    product_name,
    quantity,
    unit_price,
    dhoti_size,
    shirt_size,
    sleeve_length
  )
  select
    new_order_id,
    item.product_id,
    item.product_name,
    item.quantity,
    item.unit_price,
    nullif(item.dhoti_size, ''),
    nullif(item.shirt_size, ''),
    nullif(item.sleeve_length, '')
  from jsonb_to_recordset(order_data -> 'items') as item (
    product_id text,
    product_name text,
    quantity integer,
    unit_price numeric,
    dhoti_size text,
    shirt_size text,
    sleeve_length text
  );

  get diagnostics inserted_item_count = row_count;
  if inserted_item_count <> jsonb_array_length(order_data -> 'items') then
    raise exception 'Not all order items could be saved.';
  end if;

  update public.orders
  set subtotal = (
    select sum(line_total)
    from public.order_items
    where order_id = new_order_id
  )
  where id = new_order_id;

  return new_order_id;
end;
$$;

revoke all on function public.create_order(jsonb) from public;
grant execute on function public.create_order(jsonb) to anon, authenticated;
