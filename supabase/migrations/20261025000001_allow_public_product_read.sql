create policy "Anyone can view products"
  on public."Product"
  for select
  to anon
  using (true);
