alter table public.orders
  add column country text not null default 'India'
    check (btrim(country) <> '');

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

  if jsonb_typeof(order_data #> '{customer,whatsapp_opt_in}') is not null
    and jsonb_typeof(order_data #> '{customer,whatsapp_opt_in}') <> 'boolean'
  then
    raise exception 'Invalid WhatsApp consent value.';
  end if;

  if jsonb_array_length(order_data -> 'items') = 0
    or jsonb_array_length(order_data -> 'items') > 100
  then
    raise exception 'An order must contain between 1 and 100 items.';
  end if;

  insert into public.orders (
    full_name,
    phone,
    whatsapp_opt_in,
    email,
    address,
    apartment,
    city,
    state,
    country,
    postal_code,
    delivery_note
  )
  values (
    order_data #>> '{customer,full_name}',
    order_data #>> '{customer,phone}',
    coalesce((order_data #>> '{customer,whatsapp_opt_in}')::boolean, false),
    nullif(order_data #>> '{customer,email}', ''),
    order_data #>> '{customer,address}',
    nullif(order_data #>> '{customer,apartment}', ''),
    order_data #>> '{customer,city}',
    order_data #>> '{customer,state}',
    order_data #>> '{customer,country}',
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
    dhoti_type,
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
    nullif(item.dhoti_type, ''),
    nullif(item.shirt_size, ''),
    nullif(item.sleeve_length, '')
  from jsonb_to_recordset(order_data -> 'items') as item (
    product_id text,
    product_name text,
    quantity integer,
    unit_price numeric,
    dhoti_size text,
    dhoti_type text,
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

create or replace function public.get_admin_orders(session_token_input text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.admin_session_is_valid(session_token_input) then
    raise exception 'Administrator sign-in is required.'
      using errcode = '28000';
  end if;

  return (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', orders.id,
          'status', orders.status,
          'paymentStatus', orders.payment_status,
          'createdAt', orders.created_at,
          'subtotal', orders.subtotal,
          'shippingFee', orders.shipping_fee,
          'total', orders.subtotal + orders.shipping_fee,
          'fullName', orders.full_name,
          'phone', orders.phone,
          'email', orders.email,
          'address', orders.address,
          'apartment', orders.apartment,
          'city', orders.city,
          'state', orders.state,
          'country', orders.country,
          'postalCode', orders.postal_code,
          'deliveryNote', orders.delivery_note,
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
          )
        )
        order by orders.created_at desc, orders.id desc
      ),
      '[]'::jsonb
    )
    from public.orders
  );
end;
$$;
