alter table public.products
  add column is_premium boolean not null default false;

alter function public.save_admin_product(jsonb, text)
  rename to save_admin_product_without_premium;

revoke all on function public.save_admin_product_without_premium(jsonb, text)
  from public, anon, authenticated;

create function public.save_admin_product(
  product_data jsonb,
  session_token_input text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_product jsonb;
  product_is_premium boolean := coalesce((product_data ->> 'isPremium')::boolean, false);
  saved_product_id text;
begin
  saved_product := public.save_admin_product_without_premium(
    product_data,
    session_token_input
  );
  saved_product_id := saved_product ->> 'id';

  delete from public.product_approval_queue
  where product_id = saved_product_id;

  insert into public.product_approval_queue (product_id, product_data, submitted_at)
  values (
    saved_product_id,
    (saved_product - 'is_update') || jsonb_build_object('is_premium', product_is_premium),
    now()
  );

  return saved_product || jsonb_build_object('is_premium', product_is_premium);
end;
$$;

revoke all on function public.save_admin_product(jsonb, text) from public, anon, authenticated;
grant execute on function public.save_admin_product(jsonb, text) to anon, authenticated;

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
    is_approved,
    is_premium
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
    true,
    coalesce((staged_product ->> 'is_premium')::boolean, false)
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
    is_approved = true,
    is_premium = excluded.is_premium
  returning to_jsonb(products) into approved_product;

  delete from public.product_approval_queue
  where product_id = product_id_input;

  return approved_product;
end;
$$;

revoke all on function public.approve_product(text, text) from public, anon, authenticated;
grant execute on function public.approve_product(text, text) to anon, authenticated;
