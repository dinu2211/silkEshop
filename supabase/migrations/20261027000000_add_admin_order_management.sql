alter table public.orders
  drop constraint if exists orders_status_check,
  add constraint orders_status_check
    check (
      status in (
        'pending',
        'confirmed',
        'processing',
        'shipped',
        'out_for_delivery',
        'fulfilled',
        'cancelled'
      )
    );

create or replace function public.get_admin_orders()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role' = 'admin', false) is not true then
    raise exception 'Order administrator access is required.'
      using errcode = '42501';
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
  next_status_input text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role' = 'admin', false) is not true then
    raise exception 'Order administrator access is required.'
      using errcode = '42501';
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

revoke all on function public.get_admin_orders() from public, anon, authenticated;
revoke all on function public.update_admin_order_status(uuid, text) from public, anon, authenticated;
grant execute on function public.get_admin_orders() to authenticated;
grant execute on function public.update_admin_order_status(uuid, text) to authenticated;
