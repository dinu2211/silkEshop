do $$
begin
  if to_regclass('public.products') is null then
    if to_regclass('public."Product"') is not null then
      alter table public."Product" rename to products;
    elsif to_regclass('public."Products"') is not null then
      alter table public."Products" rename to products;
    end if;
  end if;
end
$$;

grant usage on schema public to anon;
grant select on table public.products to anon;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'products'
      and policyname = 'Anyone can view products'
  ) then
    create policy "Anyone can view products"
      on public.products
      for select
      to anon
      using (true);
  end if;
end
$$;
