drop function if exists public.save_admin_product(jsonb, text);

update public.products as products
set "variantPrices" = (
  select jsonb_agg(
    jsonb_strip_nulls(
      jsonb_build_object(
        'dhotiSize', dhoti_sizes.value,
        'dhotiType', dhoti_types.value,
        'shirtSize', shirt_sizes.value,
        'sleeveLength', sleeve_lengths.value
      )
    ) || jsonb_build_object(
      'price', coalesce(matched_variant.price, products.price),
      'quantity', 0
    )
    order by dhoti_sizes.value, dhoti_types.value, shirt_sizes.value, sleeve_lengths.value
  )
  from unnest(
    case when products.category in (
      'Silk Dhoti', 'Plain Dhoti', 'Silk Dhoti Set', 'Plain Dhoti Set', 'Combo Set',
      'Silk Material Combo'
    ) then array['8 Mulam', '9 Mulam', '10 Mulam']::text[]
    else array[null::text] end
  ) as dhoti_sizes(value)
  cross join unnest(
    case when products.category in (
      'Silk Dhoti', 'Plain Dhoti', 'Silk Dhoti Set', 'Plain Dhoti Set', 'Combo Set',
      'Silk Material Combo'
    ) then array['With Velcro Pocket', 'Without Velcro Pocket']::text[]
    else array[null::text] end
  ) as dhoti_types(value)
  cross join unnest(
    case when products.category in (
      'Silk Dhoti Set', 'Plain Dhoti Set', 'Combo Set', 'Silk Shirt', 'Plain Shirt',
      'Silk Material Combo'
    ) then array['Small', 'Medium', 'Large', 'Extra Large']::text[]
    else array[null::text] end
  ) as shirt_sizes(value)
  cross join unnest(
    case when products.category in (
      'Silk Dhoti Set', 'Plain Dhoti Set', 'Combo Set', 'Silk Shirt', 'Plain Shirt',
      'Silk Material Combo'
    ) then array['Full Sleeve', 'Half Sleeve', 'Three Quarter Sleeve']::text[]
    else array[null::text] end
  ) as sleeve_lengths(value)
  left join lateral (
    select (options.value ->> 'price')::integer as price
    from jsonb_array_elements(coalesce(products."variantPrices", '[]'::jsonb))
      with ordinality as options(value, ordinality)
    where (nullif(options.value ->> 'dhotiSize', '') is null
        or options.value ->> 'dhotiSize' = dhoti_sizes.value)
      and (nullif(options.value ->> 'dhotiType', '') is null
        or options.value ->> 'dhotiType' = dhoti_types.value)
      and (nullif(options.value ->> 'shirtSize', '') is null
        or options.value ->> 'shirtSize' = shirt_sizes.value)
      and (nullif(options.value ->> 'sleeveLength', '') is null
        or options.value ->> 'sleeveLength' = sleeve_lengths.value)
    order by
      (case when nullif(options.value ->> 'dhotiSize', '') is not null then 1 else 0 end)
      + (case when nullif(options.value ->> 'dhotiType', '') is not null then 1 else 0 end)
      + (case when nullif(options.value ->> 'shirtSize', '') is not null then 1 else 0 end)
      + (case when nullif(options.value ->> 'sleeveLength', '') is not null then 1 else 0 end) desc,
      options.ordinality
    limit 1
  ) as matched_variant on true
);

alter table public.products
  drop column price;

drop policy if exists "Authenticated users can manage products" on public.products;
revoke all on table public.products from public, anon, authenticated;
grant select on table public.products to anon;

create or replace function public.get_admin_products(session_token_input text)
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
      jsonb_agg(to_jsonb(products) order by products.name, products.id),
      '[]'::jsonb
    )
    from public.products
  );
end;
$$;

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
  product_id text := nullif(btrim(product_data ->> 'id'), '');
  product_name text := nullif(btrim(product_data ->> 'name'), '');
  product_description text := nullif(btrim(product_data ->> 'description'), '');
  product_image_url text := nullif(btrim(product_data ->> 'imageUrl'), '');
  product_category text := nullif(btrim(product_data ->> 'category'), '');
  product_collection text := nullif(product_data ->> 'collection', '');
  product_ideal_for text := nullif(product_data ->> 'idealFor', '');
  product_variant_prices jsonb := coalesce(product_data -> 'variantPrices', '[]'::jsonb);
  saved_product jsonb;
begin
  if not public.admin_session_is_valid(session_token_input) then
    raise exception 'Administrator sign-in is required.'
      using errcode = '28000';
  end if;

  if jsonb_typeof(product_data) is distinct from 'object' then
    raise exception 'Product details must be an object.';
  end if;

  if product_name is null or product_description is null
    or product_image_url is null or product_category is null
  then
    raise exception 'Product name, description, image URL, and category are required.';
  end if;

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

  if product_id is null then
    insert into public.products (
      name,
      description,
      "imageUrl",
      category,
      collection,
      "idealFor",
      "variantPrices"
    )
    values (
      product_name,
      product_description,
      product_image_url,
      product_category,
      product_collection,
      product_ideal_for,
      product_variant_prices
    )
    returning to_jsonb(products) into saved_product;
  else
    update public.products
    set
      name = product_name,
      description = product_description,
      "imageUrl" = product_image_url,
      category = product_category,
      collection = product_collection,
      "idealFor" = product_ideal_for,
      "variantPrices" = product_variant_prices
    where id = product_id
    returning to_jsonb(products) into saved_product;

    if not found then
      raise exception 'Product with id "%" was not found.', product_id;
    end if;
  end if;

  return saved_product;
end;
$$;

revoke all on function public.get_admin_products(text) from public, anon, authenticated;
revoke all on function public.save_admin_product(jsonb, text) from public, anon, authenticated;
grant execute on function public.get_admin_products(text) to anon, authenticated;
grant execute on function public.save_admin_product(jsonb, text) to anon, authenticated;
