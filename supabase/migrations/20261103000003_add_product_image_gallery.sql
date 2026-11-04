alter table public.products
  add column "imageUrls" text[] not null default '{}';

update public.products
set "imageUrls" = array["imageUrl"]
where nullif(btrim("imageUrl"), '') is not null;

alter table public.products
  alter column "imageUrls" drop default,
  add constraint products_image_urls_check
    check (
      cardinality("imageUrls") between 1 and 6
      and array_position("imageUrls", '') is null
    ),
  drop column "imageUrl";

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

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
  product_category text := nullif(btrim(product_data ->> 'category'), '');
  product_collection text := nullif(product_data ->> 'collection', '');
  product_ideal_for text := nullif(product_data ->> 'idealFor', '');
  product_image_urls text[];
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

  if product_id is null then
    insert into public.products (
      name,
      description,
      "imageUrls",
      category,
      collection,
      "idealFor",
      "variantPrices"
    )
    values (
      product_name,
      product_description,
      product_image_urls,
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
      "imageUrls" = product_image_urls,
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

revoke all on function public.save_admin_product(jsonb, text) from public, anon, authenticated;
grant execute on function public.save_admin_product(jsonb, text) to anon, authenticated;
grant execute on function public.admin_session_is_valid(text) to service_role;
