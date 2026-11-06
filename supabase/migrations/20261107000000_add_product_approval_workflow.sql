alter table public.products
  add column is_approved boolean not null default false;

update public.products
set is_approved = true;

drop policy if exists "Anyone can view products" on public.products;
drop policy if exists "Authenticated users can manage products" on public.products;
create policy "Anyone can view approved products"
  on public.products
  for select
  to anon, authenticated
  using (is_approved);

revoke insert, update, delete on table public.products from anon, authenticated;
grant select on table public.products to anon, authenticated;

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
      jsonb_agg(to_jsonb(products) order by products.name, products.id),
      '[]'::jsonb
    )
    from public.products
    where not is_approved
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
  approved_product jsonb;
begin
  if not public.admin_session_has_screen_access(session_token_input, 'manage-promo') then
    raise exception 'Product approval access is required.'
      using errcode = '42501';
  end if;

  update public.products
  set is_approved = true
  where id = product_id_input
    and not is_approved
  returning to_jsonb(products) into approved_product;

  if not found then
    raise exception 'A pending product with ID "%" was not found.', product_id_input;
  end if;

  return approved_product;
end;
$$;

revoke all on function public.get_products_pending_approval(text) from public, anon, authenticated;
revoke all on function public.approve_product(text, text) from public, anon, authenticated;
grant execute on function public.get_products_pending_approval(text) to anon, authenticated;
grant execute on function public.approve_product(text, text) to anon, authenticated;
