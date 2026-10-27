create extension if not exists pgcrypto with schema extensions;

create table public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique check (btrim(user_id) <> ''),
  password_hash text not null,
  is_active boolean not null default true,
  failed_login_attempts integer not null default 0 check (failed_login_attempts >= 0),
  locked_until timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.admin_users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create unique index admin_users_user_id_ci_idx on public.admin_users (lower(user_id));
create index admin_sessions_admin_id_idx on public.admin_sessions (admin_id);
create index admin_sessions_expires_at_idx on public.admin_sessions (expires_at);

alter table public.admin_users enable row level security;
alter table public.admin_sessions enable row level security;
revoke all on table public.admin_users, public.admin_sessions from public, anon, authenticated;

drop function if exists public.get_admin_orders();
drop function if exists public.update_admin_order_status(uuid, text);

create or replace function public.admin_login(user_id_input text, password_input text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin_record public.admin_users%rowtype;
  session_token text;
  session_expiry timestamptz := now() + interval '8 hours';
begin
  if nullif(btrim(user_id_input), '') is null
    or password_input is null
    or octet_length(password_input) < 12
    or octet_length(password_input) > 72
  then
    return jsonb_build_object('error', 'Invalid admin ID or password.');
  end if;

  select *
  into admin_record
  from public.admin_users
  where lower(user_id) = lower(btrim(user_id_input))
  for update;

  if not found or not admin_record.is_active then
    return jsonb_build_object('error', 'Invalid admin ID or password.');
  end if;

  if admin_record.locked_until is not null and admin_record.locked_until > now() then
    return jsonb_build_object('error', 'Invalid admin ID or password.');
  end if;

  if extensions.crypt(password_input, admin_record.password_hash)
    is distinct from admin_record.password_hash
  then
    update public.admin_users
    set
      failed_login_attempts = case
        when admin_record.failed_login_attempts >= 4 then 0
        else admin_record.failed_login_attempts + 1
      end,
      locked_until = case
        when admin_record.failed_login_attempts >= 4 then now() + interval '15 minutes'
        else null
      end,
      updated_at = now()
    where id = admin_record.id;

    return jsonb_build_object('error', 'Invalid admin ID or password.');
  end if;

  session_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.admin_sessions (admin_id, token_hash, expires_at)
  values (
    admin_record.id,
    encode(extensions.digest(convert_to(session_token, 'UTF8'), 'sha256'), 'hex'),
    session_expiry
  );

  update public.admin_users
  set failed_login_attempts = 0, locked_until = null, last_login_at = now(), updated_at = now()
  where id = admin_record.id;

  return jsonb_build_object(
    'sessionToken', session_token,
    'expiresAt', session_expiry,
    'userId', admin_record.user_id
  );
end;
$$;

create or replace function public.admin_session_is_valid(session_token_input text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_sessions as sessions
    join public.admin_users as admins on admins.id = sessions.admin_id
    where admins.is_active
      and sessions.expires_at > now()
      and sessions.token_hash = encode(
        extensions.digest(convert_to(session_token_input, 'UTF8'), 'sha256'),
        'hex'
      )
  );
$$;

create or replace function public.admin_logout(session_token_input text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if nullif(session_token_input, '') is null then
    return false;
  end if;

  delete from public.admin_sessions
  where token_hash = encode(
    extensions.digest(convert_to(session_token_input, 'UTF8'), 'sha256'),
    'hex'
  );

  return found;
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

  update public.orders
  set status = next_status_input
  where id = order_id_input;

  return next_status_input;
end;
$$;

revoke all on function public.admin_login(text, text) from public, anon, authenticated;
revoke all on function public.admin_session_is_valid(text) from public, anon, authenticated;
revoke all on function public.admin_logout(text) from public, anon, authenticated;
revoke all on function public.get_admin_orders(text) from public, anon, authenticated;
revoke all on function public.update_admin_order_status(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.admin_login(text, text) to anon, authenticated;
grant execute on function public.admin_session_is_valid(text) to anon, authenticated;
grant execute on function public.admin_logout(text) to anon, authenticated;
grant execute on function public.get_admin_orders(text) to anon, authenticated;
grant execute on function public.update_admin_order_status(uuid, text, text) to anon, authenticated;
