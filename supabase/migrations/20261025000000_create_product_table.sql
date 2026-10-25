create table public."Product" (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  description text not null,
  price integer not null check (price >= 0),
  "imageUrl" text not null,
  category text not null
);

alter table public."Product" enable row level security;

create policy "Authenticated users can manage products"
  on public."Product"
  for all
  to authenticated
  using (true)
  with check (true);
