-- ChinaGo phase 1: public catalogue, profiles and supplier applications
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'customer'
    check (role in ('customer','seller','supplier','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  title text not null,
  slug text not null unique,
  description text,
  source_platform text,
  source_url text,
  source_product_id text,
  price_cny numeric(12,2),
  price_xof numeric(14,2),
  currency text not null default 'XOF',
  stock_status text not null default 'unknown'
    check (stock_status in ('in_stock','out_of_stock','preorder','unknown')),
  is_featured boolean not null default false,
  is_winner boolean not null default false,
  status text not null default 'draft'
    check (status in ('draft','pending','active','rejected','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.supplier_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_name text not null,
  contact_name text not null,
  email text not null,
  phone text not null,
  country text not null default 'China',
  website_url text,
  product_categories text[] not null default '{}',
  message text,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

create index products_category_id_idx on public.products(category_id);
create index products_status_winner_idx on public.products(status, is_winner);
create index products_created_at_idx on public.products(created_at desc);
create index product_images_product_id_idx on public.product_images(product_id);
create index supplier_applications_user_id_idx on public.supplier_applications(user_id);

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.supplier_applications enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy "Users can create their own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Public can read active categories"
  on public.categories for select to anon, authenticated
  using (is_active = true);
create policy "Public can read active products"
  on public.products for select to anon, authenticated
  using (status = 'active');
create policy "Public can read images of active products"
  on public.product_images for select to anon, authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_id and p.status = 'active'
  ));
create policy "Users can submit supplier applications"
  on public.supplier_applications for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can read their own supplier applications"
  on public.supplier_applications for select to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.categories, public.products, public.product_images to anon, authenticated;
grant select, insert on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
grant insert (user_id, company_name, contact_name, email, phone, country, website_url, product_categories, message)
  on public.supplier_applications to authenticated;
grant select on public.supplier_applications to authenticated;
