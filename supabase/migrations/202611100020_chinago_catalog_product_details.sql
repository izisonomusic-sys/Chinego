-- Store structured product details in the public ChinaGo catalog.
alter table public.products
  add column if not exists product_variants jsonb not null default '[]'::jsonb,
  add column if not exists product_options jsonb not null default '[]'::jsonb,
  add column if not exists minimum_order_quantity integer,
  add column if not exists original_currency text,
  add column if not exists original_price_min numeric(14,2),
  add column if not exists original_price_max numeric(14,2),
  add column if not exists supplier_company text;
