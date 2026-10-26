begin;

do $$
declare
  target_order_id constant uuid := '02315d72-0d50-4500-8271-84931f689314';
  tracking_stage text;
  tracking_stages constant text[] := array[
    'pending',
    'confirmed',
    'processing',
    'shipped',
    'out_for_delivery',
    'fulfilled',
    'cancelled'
  ];
  stage_created_at timestamptz;
  event_id uuid;
  tracking_response jsonb;
  tracked_order jsonb;
  latest_event jsonb;
begin
  if not exists (
    select 1
    from public.orders
    where id = target_order_id
  ) then
    raise exception 'Order % does not exist.', target_order_id;
  end if;

  select greatest(
    clock_timestamp(),
    coalesce(max(created_at), '-infinity'::timestamptz)
  )
  into stage_created_at
  from public.order_tracking_details
  where order_id = target_order_id;

  foreach tracking_stage in array tracking_stages loop
    stage_created_at := stage_created_at + interval '1 second';

    insert into public.order_tracking_details (
      order_id,
      status,
      title,
      description,
      created_at
    )
    values (
      target_order_id,
      tracking_stage,
      'Test: ' || tracking_stage,
      'Persistent order tracking stage test.',
      stage_created_at
    )
    returning id into event_id;

    tracking_response := public.get_order_tracking_details(target_order_id::text, null);
    if jsonb_typeof(tracking_response) is distinct from 'array'
      or jsonb_array_length(tracking_response) <> 1
    then
      raise exception 'Expected one tracking result for order %; got %.',
        target_order_id, tracking_response;
    end if;

    tracked_order := tracking_response -> 0;
    if tracked_order ->> 'status' is distinct from tracking_stage then
      raise exception 'Expected current status %, got %.',
        tracking_stage, tracked_order ->> 'status';
    end if;

    latest_event := tracked_order -> 'events'
      -> (jsonb_array_length(tracked_order -> 'events') - 1);
    if latest_event ->> 'id' is distinct from event_id::text
      or latest_event ->> 'status' is distinct from tracking_stage
    then
      raise exception 'Latest event did not match test stage %: %.',
        tracking_stage, latest_event;
    end if;

    raise notice 'PASS: order tracking stage %', tracking_stage;
  end loop;
end;
$$;

commit;
