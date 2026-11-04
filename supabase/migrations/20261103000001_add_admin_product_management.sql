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
  product_price integer;
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

  begin
    product_price := (product_data ->> 'price')::integer;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'Product price must be a non-negative whole number.';
  end;

  if product_price is null or product_price < 0 then
    raise exception 'Product price must be a non-negative whole number.';
  end if;

  if jsonb_typeof(product_variant_prices) is distinct from 'array' then
    raise exception 'Option prices must be an array.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(product_variant_prices) as options(value)
    where jsonb_typeof(options.value) is distinct from 'object'
      or case
        when jsonb_typeof(options.value -> 'price') = 'number' then
          (options.value ->> 'price')::numeric < 0
          or trunc((options.value ->> 'price')::numeric)
            <> (options.value ->> 'price')::numeric
        else true
      end
  ) then
    raise exception 'Option prices must be non-negative whole numbers.';
  end if;

  if product_id is null then
    insert into public.products (
      name,
      description,
      price,
      "imageUrl",
      category,
      collection,
      "idealFor",
      "variantPrices"
    )
    values (
      product_name,
      product_description,
      product_price,
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
      price = product_price,
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
