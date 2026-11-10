-- ChinaGo phase 2: member workspace, partner applications, stores, favorites, notifications and order foundations
begin;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('customer','dropshipper','seller','supplier','admin'));

create table if not exists public.seller_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_type text not null check (account_type in ('dropshipper','ecommerce')),
  business_name text not null,
  contact_name text not null,
  email text not null,
  phone text not null,
  store_url text,
  message text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);
create index if not exists seller_applications_user_created_idx on public.seller_applications(user_id, created_at desc);
alter table public.seller_applications enable row level security;
drop policy if exists "Users can submit their own seller applications" on public.seller_applications;
create policy "Users can submit their own seller applications" on public.seller_applications
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can read their own seller applications" on public.seller_applications;
create policy "Users can read their own seller applications" on public.seller_applications
  for select to authenticated using ((select auth.uid()) = user_id);
grant select, insert on public.seller_applications to authenticated;

create table if not exists public.product_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
alter table public.product_favorites enable row level security;
create policy "Users manage their own product favorites" on public.product_favorites
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, insert, delete on public.product_favorites to authenticated;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  kind text not null default 'info' check (kind in ('info','success','warning','order','import','partner')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);
alter table public.notifications enable row level security;
create policy "Users read their own notifications" on public.notifications
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users mark their own notifications read" on public.notifications
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text,
  platform text not null default 'chinago' check (platform in ('chinago','shopify')),
  shopify_domain text,
  status text not null default 'draft' check (status in ('draft','active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists stores_owner_idx on public.stores(owner_id);
alter table public.stores enable row level security;
create policy "Public can view active stores" on public.stores
  for select to anon, authenticated using (status = 'active' or owner_id = (select auth.uid()));
create policy "Approved sellers can create their own stores" on public.stores
  for insert to authenticated with check (
    owner_id = (select auth.uid()) and exists (
      select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('seller','dropshipper','admin')
    )
  );
create policy "Store owners can update their own stores" on public.stores
  for update to authenticated using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
grant select, insert, update on public.stores to authenticated;
grant select on public.stores to anon;

create table if not exists public.store_products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  title text not null,
  description text,
  image_url text,
  source_url text,
  source_platform text check (source_platform in ('alibaba','amazon','ebay','other')),
  cost_price_xof numeric(14,2),
  selling_price_xof numeric(14,2),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_product_price_check check (
    cost_price_xof is null or selling_price_xof is null or selling_price_xof >= cost_price_xof
  )
);
create index if not exists store_products_store_created_idx on public.store_products(store_id, created_at desc);
alter table public.store_products enable row level security;
create policy "Public can view published products in active stores" on public.store_products
  for select to anon, authenticated using (
    status = 'published' and exists (select 1 from public.stores s where s.id = store_id and s.status = 'active')
  );
create policy "Store owners can view all their store products" on public.store_products
  for select to authenticated using (
    exists (select 1 from public.stores s where s.id = store_id and s.owner_id = (select auth.uid()))
  );
create policy "Store owners can create products" on public.store_products
  for insert to authenticated with check (
    exists (select 1 from public.stores s where s.id = store_id and s.owner_id = (select auth.uid()))
  );
create policy "Store owners can update products" on public.store_products
  for update to authenticated using (
    exists (select 1 from public.stores s where s.id = store_id and s.owner_id = (select auth.uid()))
  ) with check (
    exists (select 1 from public.stores s where s.id = store_id and s.owner_id = (select auth.uid()))
  );
create policy "Store owners can delete products" on public.store_products
  for delete to authenticated using (
    exists (select 1 from public.stores s where s.id = store_id and s.owner_id = (select auth.uid()))
  );
grant select on public.store_products to anon;
grant select, insert, update, delete on public.store_products to authenticated;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid not null references auth.users(id) on delete restrict,
  store_id uuid references public.stores(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','awaiting_payment','paid','processing','shipped','delivered','cancelled','refunded')),
  currency text not null default 'XOF',
  subtotal_xof numeric(14,2) not null default 0,
  shipping_xof numeric(14,2) not null default 0,
  total_xof numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_customer_created_idx on public.orders(customer_id, created_at desc);
create index if not exists orders_store_created_idx on public.orders(store_id, created_at desc);
alter table public.orders enable row level security;
create policy "Customers and store owners can view related orders" on public.orders
  for select to authenticated using (
    customer_id = (select auth.uid()) or exists (
      select 1 from public.stores s where s.id = store_id and s.owner_id = (select auth.uid())
    )
  );
grant select on public.orders to authenticated;

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  store_product_id uuid references public.store_products(id) on delete set null,
  product_title text not null,
  quantity integer not null check (quantity > 0),
  unit_price_xof numeric(14,2) not null check (unit_price_xof >= 0),
  line_total_xof numeric(14,2) not null check (line_total_xof >= 0)
);
create index if not exists order_items_order_idx on public.order_items(order_id);
alter table public.order_items enable row level security;
create policy "Users can view items of their related orders" on public.order_items
  for select to authenticated using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and (
        o.customer_id = (select auth.uid()) or exists (
          select 1 from public.stores s where s.id = o.store_id and s.owner_id = (select auth.uid())
        )
      )
    )
  );
grant select on public.order_items to authenticated;

create or replace function private.notify_chinago_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'import_requests' then
    insert into public.notifications(user_id, title, body, kind)
    values (new.user_id, 'Demande d’importation reçue', 'Votre demande a bien été enregistrée. Vous pourrez suivre son évolution depuis votre espace.', 'import');
  elsif tg_table_name = 'seller_applications' then
    insert into public.notifications(user_id, title, body, kind)
    values (new.user_id, 'Candidature envoyée', 'Votre demande pour rejoindre ChinaGo a été transmise. Elle sera examinée par notre équipe.', 'partner');
  elsif tg_table_name = 'supplier_applications' then
    insert into public.notifications(user_id, title, body, kind)
    values (new.user_id, 'Candidature fournisseur reçue', 'Votre candidature fournisseur a bien été enregistrée.', 'partner');
  end if;
  return new;
end;
$$;
revoke all on function private.notify_chinago_user() from public, anon, authenticated;
drop trigger if exists notify_chinago_import_request on public.import_requests;
create trigger notify_chinago_import_request after insert on public.import_requests
  for each row execute function private.notify_chinago_user();
drop trigger if exists notify_chinago_seller_application on public.seller_applications;
create trigger notify_chinago_seller_application after insert on public.seller_applications
  for each row execute function private.notify_chinago_user();
drop trigger if exists notify_chinago_supplier_application on public.supplier_applications;
create trigger notify_chinago_supplier_application after insert on public.supplier_applications
  for each row execute function private.notify_chinago_user();

commit;