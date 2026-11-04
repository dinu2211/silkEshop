alter table public.order_items
  add column dhoti_type text;

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

create or replace function public.deduct_order_inventory(order_id_input uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_item record;
  product_variants jsonb;
  matched_variant jsonb;
  matched_ordinality bigint;
  available_quantity integer;
begin
  for order_item in
    select
      order_items.product_id,
      order_items.dhoti_size,
      order_items.dhoti_type,
      order_items.shirt_size,
      order_items.sleeve_length,
      sum(order_items.quantity)::bigint as quantity
    from public.order_items
    where order_items.order_id = order_id_input
    group by
      order_items.product_id,
      order_items.dhoti_size,
      order_items.dhoti_type,
      order_items.shirt_size,
      order_items.sleeve_length
    order by
      order_items.product_id,
      order_items.dhoti_size,
      order_items.dhoti_type,
      order_items.shirt_size,
      order_items.sleeve_length
  loop
    select products."variantPrices"
    into product_variants
    from public.products as products
    where products.id = order_item.product_id
    for update;

    if not found then
      raise exception 'Product "%" is no longer available.', order_item.product_id;
    end if;

    select options.ordinality, options.value
    into matched_ordinality, matched_variant
    from jsonb_array_elements(product_variants) with ordinality as options(value, ordinality)
    where coalesce(options.value ->> 'dhotiSize', '') = coalesce(order_item.dhoti_size, '')
      and coalesce(options.value ->> 'dhotiType', '') = coalesce(order_item.dhoti_type, '')
      and coalesce(options.value ->> 'shirtSize', '') = coalesce(order_item.shirt_size, '')
      and coalesce(options.value ->> 'sleeveLength', '') = coalesce(order_item.sleeve_length, '')
    order by options.ordinality
    limit 1;

    if not found then
      raise exception 'The selected variant of "%" is no longer available.',
        order_item.product_id;
    end if;

    if jsonb_typeof(matched_variant -> 'quantity') is distinct from 'number' then
      raise exception 'Stock for the selected variant of "%" is invalid.',
        order_item.product_id;
    end if;

    available_quantity := (matched_variant ->> 'quantity')::integer;
    if available_quantity < order_item.quantity then
      raise exception 'Insufficient stock for "%": % available, % ordered.',
        order_item.product_id, available_quantity, order_item.quantity;
    end if;

    update public.products
    set "variantPrices" = jsonb_set(
      product_variants,
      array[(matched_ordinality - 1)::text, 'quantity'],
      to_jsonb(available_quantity - order_item.quantity::integer),
      false
    )
    where id = order_item.product_id;
  end loop;
end;
$$;

create or replace function public.update_admin_order_status(
  order_id_input uuid,
  next_status_input text,
  session_token_input text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
begin
  if not public.admin_session_is_valid(session_token_input) then
    raise exception 'Administrator sign-in is required.'
      using errcode = '28000';
  end if;

  select orders.status
  into current_status
  from public.orders
  where orders.id = order_id_input
  for update;

  if not found then
    raise exception 'Order was not found.';
  end if;

  if not (
    (current_status = 'pending' and next_status_input = 'confirmed')
    or (current_status = 'confirmed' and next_status_input = 'processing')
    or (current_status = 'processing' and next_status_input = 'shipped')
    or (current_status = 'shipped' and next_status_input = 'out_for_delivery')
    or (current_status = 'out_for_delivery' and next_status_input = 'fulfilled')
    or (
      next_status_input = 'cancelled'
      and current_status not in ('fulfilled', 'cancelled')
    )
  ) then
    raise exception 'Invalid order status transition from % to %.',
      current_status, next_status_input;
  end if;

  if current_status = 'pending' and next_status_input = 'confirmed' then
    perform public.deduct_order_inventory(order_id_input);
  end if;

  update public.orders
  set status = next_status_input
  where id = order_id_input;

  return next_status_input;
end;
$$;

create or replace function public.confirm_paid_order(
  order_id_input uuid,
  razorpay_order_id_input text,
  razorpay_payment_id_input text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_record public.orders%rowtype;
begin
  if nullif(razorpay_order_id_input, '') is null
    or nullif(razorpay_payment_id_input, '') is null
  then
    raise exception 'Payment confirmation details are required.';
  end if;

  select *
  into order_record
  from public.orders
  where id = order_id_input
  for update;

  if not found then
    raise exception 'Order was not found.';
  end if;

  if order_record.payment_status = 'paid'
    and order_record.razorpay_payment_id = razorpay_payment_id_input
  then
    return false;
  end if;

  if order_record.status <> 'pending'
    or order_record.payment_status <> 'pending'
    or order_record.razorpay_order_id is distinct from razorpay_order_id_input
  then
    raise exception 'The order changed or the payment order does not match.';
  end if;

  perform public.deduct_order_inventory(order_id_input);

  update public.orders
  set
    status = 'confirmed',
    payment_status = 'paid',
    razorpay_payment_id = razorpay_payment_id_input
  where id = order_id_input;

  return true;
end;
$$;

revoke all on function public.create_order(jsonb) from public;
grant execute on function public.create_order(jsonb) to anon, authenticated;

revoke all on function public.deduct_order_inventory(uuid) from public, anon, authenticated;
revoke all on function public.confirm_paid_order(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.confirm_paid_order(uuid, text, text) to service_role;

revoke all on function public.update_admin_order_status(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.update_admin_order_status(uuid, text, text)
  to anon, authenticated, service_role;
