create or replace function public.reject_pending_product(
  product_id_input text,
  session_token_input text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  rejected_product_id text;
begin
  if not public.admin_session_has_screen_access(session_token_input, 'manage-promo') then
    raise exception 'Product approval access is required.'
      using errcode = '42501';
  end if;

  delete from public.product_approval_queue
  where product_id = product_id_input
  returning product_id into rejected_product_id;

  if rejected_product_id is null then
    raise exception 'A pending product with ID "%" was not found.', product_id_input;
  end if;

  return rejected_product_id;
end;
$$;

revoke all on function public.reject_pending_product(text, text) from public, anon, authenticated;
grant execute on function public.reject_pending_product(text, text) to anon, authenticated;

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
      jsonb_agg(
        to_jsonb(products) || jsonb_build_object(
          'is_update',
          exists (
            select 1
            from public.product_approval_queue as queue
            where queue.product_id = products.id
          )
        )
        order by products.name, products.id
      ),
      '[]'::jsonb
    )
    from public.products as products
  );
end;
$$;

revoke all on function public.get_admin_products(text) from public, anon, authenticated;
grant execute on function public.get_admin_products(text) to anon, authenticated;

create or replace function public.prevent_pending_product_resubmission()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'This product already has changes waiting for approval.';
end;
$$;

create trigger product_approval_queue_prevent_resubmission
before update on public.product_approval_queue
for each row
execute function public.prevent_pending_product_resubmission();
