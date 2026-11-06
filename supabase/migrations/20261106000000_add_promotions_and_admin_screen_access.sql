alter table public.admin_users
  add column screen_access text[] not null
    default array['manage-products', 'manage-orders']::text[],
  add constraint admin_users_screen_access_check
    check (screen_access <@ array['manage-products', 'manage-orders', 'manage-promo']::text[]);

alter table public.orders
  add column promo_code text,
  add column discount_amount numeric(12, 2) not null default 0
    check (discount_amount >= 0);

create table public.promos (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[A-Z0-9][A-Z0-9_-]{1,39}$'),
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  discount_value numeric(12, 2) not null check (discount_value > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promos_percentage_value_check
    check (discount_type <> 'percentage' or discount_value <= 100)
);

create unique index promos_code_ci_idx on public.promos (lower(code));
alter table public.promos enable row level security;
revoke all on table public.promos from public, anon, authenticated;

create or replace function public.admin_session_screen_access(session_token_input text)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  screen_access_result text[];
begin
  select admins.screen_access
  into screen_access_result
  from public.admin_sessions as sessions
  join public.admin_users as admins on admins.id = sessions.admin_id
  where admins.is_active
    and sessions.expires_at > now()
    and sessions.token_hash = encode(
      extensions.digest(convert_to(session_token_input, 'UTF8'), 'sha256'),
      'hex'
    );

  if not found then
    raise exception 'Administrator sign-in is required.'
      using errcode = '28000';
  end if;

  return screen_access_result;
end;
$$;

create or replace function public.admin_session_has_screen_access(
  session_token_input text,
  screen_input text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select screen_input = any(public.admin_session_screen_access(session_token_input));
$$;

create or replace function public.get_admin_promos(session_token_input text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.admin_session_has_screen_access(session_token_input, 'manage-promo') then
    raise exception 'Promo management access is required.'
      using errcode = '42501';
  end if;

  return (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', promos.id,
          'code', promos.code,
          'discountType', promos.discount_type,
          'discountValue', promos.discount_value,
          'isActive', promos.is_active,
          'createdAt', promos.created_at
        )
        order by promos.created_at desc, promos.code
      ),
      '[]'::jsonb
    )
    from public.promos
  );
end;
$$;

create or replace function public.save_admin_promo(
  promo_data jsonb,
  session_token_input text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  promo_id uuid;
  promo_code text := upper(nullif(btrim(promo_data ->> 'code'), ''));
  discount_type_value text := promo_data ->> 'discountType';
  discount_value_input numeric;
  is_active_input boolean;
  saved_promo jsonb;
begin
  if not public.admin_session_has_screen_access(session_token_input, 'manage-promo') then
    raise exception 'Promo management access is required.'
      using errcode = '42501';
  end if;

  if jsonb_typeof(promo_data) is distinct from 'object' then
    raise exception 'Promo details must be an object.';
  end if;
  if promo_code is null or promo_code !~ '^[A-Z0-9][A-Z0-9_-]{1,39}$' then
    raise exception 'Promo codes must be 2 to 40 letters, numbers, underscores, or hyphens.';
  end if;
  if discount_type_value is null or discount_type_value not in ('percentage', 'fixed') then
    raise exception 'Choose a percentage or fixed-amount discount.';
  end if;

  begin
    discount_value_input := (promo_data ->> 'discountValue')::numeric;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'Promo discount must be a positive number.';
  end;
  if discount_value_input is null or discount_value_input <= 0
    or (discount_type_value = 'percentage' and discount_value_input > 100)
  then
    raise exception 'Promo discount must be positive; percentage discounts cannot exceed 100.';
  end if;

  if jsonb_typeof(promo_data -> 'isActive') is distinct from 'boolean' then
    raise exception 'Promo active state must be true or false.';
  end if;
  is_active_input := (promo_data ->> 'isActive')::boolean;

  if nullif(promo_data ->> 'id', '') is not null then
    begin
      promo_id := (promo_data ->> 'id')::uuid;
    exception
      when invalid_text_representation then
        raise exception 'Promo ID is invalid.';
    end;

    update public.promos
    set
      code = promo_code,
      discount_type = discount_type_value,
      discount_value = discount_value_input,
      is_active = is_active_input,
      updated_at = now()
    where id = promo_id
    returning jsonb_build_object(
      'id', promos.id,
      'code', promos.code,
      'discountType', promos.discount_type,
      'discountValue', promos.discount_value,
      'isActive', promos.is_active,
      'createdAt', promos.created_at
    ) into saved_promo;

    if not found then
      raise exception 'Promo was not found.';
    end if;
  else
    insert into public.promos (code, discount_type, discount_value, is_active)
    values (promo_code, discount_type_value, discount_value_input, is_active_input)
    returning jsonb_build_object(
      'id', promos.id,
      'code', promos.code,
      'discountType', promos.discount_type,
      'discountValue', promos.discount_value,
      'isActive', promos.is_active,
      'createdAt', promos.created_at
    ) into saved_promo;
  end if;

  return saved_promo;
end;
$$;

create or replace function public.validate_promo_code(
  promo_code_input text,
  subtotal_input numeric
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  promo_record public.promos%rowtype;
  applied_discount numeric(12, 2);
begin
  if subtotal_input is null or subtotal_input < 0 then
    raise exception 'Order subtotal must be a non-negative amount.';
  end if;

  select *
  into promo_record
  from public.promos
  where lower(code) = lower(btrim(promo_code_input))
    and is_active;

  if not found then
    return null;
  end if;

  applied_discount := least(
    subtotal_input,
    case
      when promo_record.discount_type = 'percentage'
        then round(subtotal_input * promo_record.discount_value / 100, 2)
      else promo_record.discount_value
    end
  );

  return jsonb_build_object(
    'code', promo_record.code,
    'discountType', promo_record.discount_type,
    'discountValue', promo_record.discount_value,
    'discountAmount', applied_discount
  );
end;
$$;

create or replace function public.create_order(order_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_order_id uuid;
  inserted_item_count integer;
  submitted_promo_code text := upper(nullif(btrim(order_data ->> 'promo_code'), ''));
  matched_promo public.promos%rowtype;
  order_subtotal numeric(12, 2);
  applied_discount numeric(12, 2) := 0;
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

  select sum(line_total)
  into order_subtotal
  from public.order_items
  where order_id = new_order_id;

  if submitted_promo_code is not null then
    select *
    into matched_promo
    from public.promos
    where lower(code) = lower(submitted_promo_code)
      and is_active
    for share;

    if not found then
      raise exception 'That promo code is invalid or inactive.';
    end if;

    applied_discount := least(
      order_subtotal,
      case
        when matched_promo.discount_type = 'percentage'
          then round(order_subtotal * matched_promo.discount_value / 100, 2)
        else matched_promo.discount_value
      end
    );
  end if;

  update public.orders
  set
    subtotal = order_subtotal,
    promo_code = submitted_promo_code,
    discount_amount = applied_discount
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
          'discountAmount', orders.discount_amount,
          'promoCode', orders.promo_code,
          'total', orders.subtotal + orders.shipping_fee - orders.discount_amount,
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
  select coalesce(
    jsonb_agg(order_result.payload order by order_result.created_at desc, order_result.order_id desc),
    '[]'::jsonb
  )
  from (
    select
      orders.id as order_id,
      orders.created_at,
      jsonb_build_object(
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
        'discountAmount', orders.discount_amount,
        'promoCode', orders.promo_code,
        'total', orders.subtotal + orders.shipping_fee - orders.discount_amount,
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
      ) as payload
    from public.orders
    where (nullif(btrim(order_id_input), '') is not null
      or nullif(btrim(phone_input), '') is not null)
      and (
        nullif(btrim(order_id_input), '') is null
        or orders.id::text = btrim(order_id_input)
      )
      and (
        nullif(btrim(phone_input), '') is null
        or btrim(orders.phone) = btrim(phone_input)
      )
  ) as order_result;
$$;

revoke all on function public.admin_session_screen_access(text) from public, anon, authenticated;
revoke all on function public.admin_session_has_screen_access(text, text) from public, anon, authenticated;
revoke all on function public.get_admin_promos(text) from public, anon, authenticated;
revoke all on function public.save_admin_promo(jsonb, text) from public, anon, authenticated;
revoke all on function public.validate_promo_code(text, numeric) from public, anon, authenticated;
revoke all on function public.create_order(jsonb) from public;
revoke all on function public.get_admin_orders(text) from public, anon, authenticated;
revoke all on function public.get_order_tracking_details(text, text) from public;

grant execute on function public.admin_session_screen_access(text) to anon, authenticated;
grant execute on function public.admin_session_has_screen_access(text, text) to anon, authenticated;
grant execute on function public.get_admin_promos(text) to anon, authenticated;
grant execute on function public.save_admin_promo(jsonb, text) to anon, authenticated;
grant execute on function public.validate_promo_code(text, numeric) to anon, authenticated;
grant execute on function public.create_order(jsonb) to anon, authenticated;
grant execute on function public.get_admin_orders(text) to anon, authenticated;
grant execute on function public.get_order_tracking_details(text, text) to anon, authenticated;
