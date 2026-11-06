create table public.product_approval_queue (
  product_id text primary key,
  product_data jsonb not null check (jsonb_typeof(product_data) = 'object'),
  submitted_at timestamptz not null default now()
);

alter table public.product_approval_queue enable row level security;
revoke all on table public.product_approval_queue from public, anon, authenticated;

insert into public.product_approval_queue (product_id, product_data)
select products.id, to_jsonb(products)
from public.products
where not products.is_approved
on conflict (product_id) do nothing;

delete from public.products
where not is_approved;

create or replace function public.save_admin_product(
  product_data jsonb,
  session_token_input text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_product_id text := nullif(btrim(product_data ->> 'id'), '');
  target_product_id text := coalesce(
    requested_product_id,
    gen_random_uuid()::text
  );
  product_name text := nullif(btrim(product_data ->> 'name'), '');
  product_description text := nullif(btrim(product_data ->> 'description'), '');
  product_category text := nullif(btrim(product_data ->> 'category'), '');
  product_collection text := nullif(product_data ->> 'collection', '');
  product_ideal_for text := nullif(product_data ->> 'idealFor', '');
  product_image_urls text[];
  product_variant_prices jsonb := coalesce(product_data -> 'variantPrices', '[]'::jsonb);
  staged_product jsonb;
begin
  if not public.admin_session_is_valid(session_token_input) then
    raise exception 'Administrator sign-in is required.'
      using errcode = '28000';
  end if;

  if jsonb_typeof(product_data) is distinct from 'object' then
    raise exception 'Product details must be an object.';
  end if;

  if product_name is null or product_description is null or product_category is null then
    raise exception 'Product name, description, and category are required.';
  end if;

  if jsonb_typeof(product_data -> 'imageUrls') is distinct from 'array' then
    raise exception 'A product must have between one and six valid images.';
  end if;

  if jsonb_array_length(product_data -> 'imageUrls') not between 1 and 6 then
    raise exception 'A product must have between one and six valid images.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(product_data -> 'imageUrls') as images(value)
    where jsonb_typeof(images.value) is distinct from 'string'
      or btrim(images.value #>> '{}') = ''
  ) then
    raise exception 'A product must have between one and six valid images.';
  end if;

  select array_agg(images.value #>> '{}' order by images.ordinality)
  into product_image_urls
  from jsonb_array_elements(product_data -> 'imageUrls')
    with ordinality as images(value, ordinality);

  if jsonb_typeof(product_variant_prices) is distinct from 'array' then
    raise exception 'Product variants must be an array.';
  end if;

  if jsonb_array_length(product_variant_prices) = 0 then
    raise exception 'At least one product variant is required.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(product_variant_prices) as options(value)
    where jsonb_typeof(options.value) is distinct from 'object'
      or case
        when jsonb_typeof(options.value -> 'price') = 'number'
          and jsonb_typeof(options.value -> 'quantity') = 'number'
        then
          (options.value ->> 'price')::numeric < 0
          or (options.value ->> 'price')::numeric > 2147483647
          or trunc((options.value ->> 'price')::numeric)
            <> (options.value ->> 'price')::numeric
          or (options.value ->> 'quantity')::numeric < 0
          or (options.value ->> 'quantity')::numeric > 2147483647
          or trunc((options.value ->> 'quantity')::numeric)
            <> (options.value ->> 'quantity')::numeric
        else true
      end
      or case
        when jsonb_typeof(options.value) = 'object' then exists (
          select 1
          from jsonb_each(options.value) as fields(key, value)
          where fields.key in ('dhotiSize', 'shirtSize', 'sleeveLength', 'dhotiType')
            and jsonb_typeof(fields.value) is distinct from 'string'
        )
        else false
      end
      or (
        product_category in (
          'Silk Dhoti', 'Plain Dhoti', 'Silk Dhoti Set', 'Plain Dhoti Set', 'Combo Set',
          'Silk Material Combo'
        )
        and (
          options.value ->> 'dhotiSize' is null
          or options.value ->> 'dhotiSize' not in ('8 Mulam', '9 Mulam', '10 Mulam')
          or options.value ->> 'dhotiType' is null
          or options.value ->> 'dhotiType' not in (
            'With Velcro Pocket', 'Without Velcro Pocket'
          )
        )
      )
      or (
        product_category in (
          'Silk Dhoti Set', 'Plain Dhoti Set', 'Combo Set', 'Silk Shirt', 'Plain Shirt',
          'Silk Material Combo'
        )
        and (
          options.value ->> 'shirtSize' is null
          or options.value ->> 'shirtSize' not in ('Small', 'Medium', 'Large', 'Extra Large')
          or options.value ->> 'sleeveLength' is null
          or options.value ->> 'sleeveLength' not in (
            'Full Sleeve', 'Half Sleeve', 'Three Quarter Sleeve'
          )
        )
      )
  ) then
    raise exception 'Each variant needs a non-negative whole-number price and quantity.';
  end if;

  if requested_product_id is not null and not exists (
    select 1
    from public.products as products
    where products.id = target_product_id
    union all
    select 1
    from public.product_approval_queue as queue
    where queue.product_id = target_product_id
  ) then
    raise exception 'Product with id "%" was not found.', target_product_id;
  end if;

  staged_product := jsonb_build_object(
    'id', target_product_id,
    'name', product_name,
    'description', product_description,
    'imageUrls', product_image_urls,
    'category', product_category,
    'collection', product_collection,
    'idealFor', product_ideal_for,
    'variantPrices', product_variant_prices,
    'is_approved', false
  );

  insert into public.product_approval_queue (product_id, product_data, submitted_at)
  values (target_product_id, staged_product, now())
  on conflict (product_id) do update
  set product_data = excluded.product_data,
      submitted_at = excluded.submitted_at;

  return staged_product || jsonb_build_object(
    'is_update',
    exists (select 1 from public.products where id = target_product_id)
  );
end;
$$;

create or replace function public.get_products_pending_approval(session_token_input text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.admin_session_has_screen_access(session_token_input, 'manage-promo') then
    raise exception 'Product approval access is required.'
      using errcode = '42501';
  end if;

  return (
    select coalesce(
      jsonb_agg(
        queue.product_data || jsonb_build_object(
          'is_approved', false,
          'is_update', exists (
            select 1 from public.products where products.id = queue.product_id
          )
        )
        order by queue.submitted_at, queue.product_id
      ),
      '[]'::jsonb
    )
    from public.product_approval_queue as queue
  );
end;
$$;

create or replace function public.approve_product(
  product_id_input text,
  session_token_input text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  staged_product jsonb;
  approved_product jsonb;
begin
  if not public.admin_session_has_screen_access(session_token_input, 'manage-promo') then
    raise exception 'Product approval access is required.'
      using errcode = '42501';
  end if;

  select queue.product_data
  into staged_product
  from public.product_approval_queue as queue
  where queue.product_id = product_id_input
  for update;

  if not found then
    raise exception 'A pending product with ID "%" was not found.', product_id_input;
  end if;

  insert into public.products (
    id,
    name,
    description,
    "imageUrls",
    category,
    collection,
    "idealFor",
    "variantPrices",
    is_approved
  )
  values (
    product_id_input,
    staged_product ->> 'name',
    staged_product ->> 'description',
    array(select jsonb_array_elements_text(staged_product -> 'imageUrls')),
    staged_product ->> 'category',
    staged_product ->> 'collection',
    staged_product ->> 'idealFor',
    staged_product -> 'variantPrices',
    true
  )
  on conflict (id) do update
  set
    name = excluded.name,
    description = excluded.description,
    "imageUrls" = excluded."imageUrls",
    category = excluded.category,
    collection = excluded.collection,
    "idealFor" = excluded."idealFor",
    "variantPrices" = excluded."variantPrices",
    is_approved = true
  returning to_jsonb(products) into approved_product;

  delete from public.product_approval_queue
  where product_id = product_id_input;

  return approved_product;
end;
$$;

revoke all on function public.save_admin_product(jsonb, text) from public, anon, authenticated;
revoke all on function public.get_products_pending_approval(text) from public, anon, authenticated;
revoke all on function public.approve_product(text, text) from public, anon, authenticated;
grant execute on function public.save_admin_product(jsonb, text) to anon, authenticated;
grant execute on function public.get_products_pending_approval(text) to anon, authenticated;
grant execute on function public.approve_product(text, text) to anon, authenticated;
