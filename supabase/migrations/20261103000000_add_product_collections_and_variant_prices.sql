alter table public.products
  add column collection text
    check (
      collection is null
      or collection in (
        'Function',
        'Wedding',
        'Party Wear',
        'Engagement',
        'Summer Special',
        'Art Silk',
        'Set Dress',
        'Tissue Collection',
        'Royal Tissue',
        'Silk Collection'
      )
    ),
  add column "idealFor" text
    check ("idealFor" is null or "idealFor" in ('Kid', 'Men', 'Dad & Son Combo')),
  add column "variantPrices" jsonb not null default '[]'::jsonb
    check (jsonb_typeof("variantPrices") = 'array');
