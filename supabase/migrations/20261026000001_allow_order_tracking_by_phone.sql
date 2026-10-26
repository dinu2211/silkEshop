drop function public.get_order_tracking_details(text, text);

create function public.get_order_tracking_details(
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

revoke all on function public.get_order_tracking_details(text, text) from public;
grant execute on function public.get_order_tracking_details(text, text) to anon, authenticated;
