-- ChinaGo central treasury and Shopify-style store foundation
create table if not exists public.platform_cash_ledger (
 id uuid primary key default gen_random_uuid(), direction text not null check(direction in ('credit','debit')),
 category text not null check(category in ('customer_collection','supplier_payment','cargo_payment','seller_payout','refund','chargeback','adjustment')),
 amount_xof numeric(14,2) not null check(amount_xof>0), currency text not null default 'XOF' check(currency='XOF'),
 source_type text not null, source_id uuid not null, description text, created_by uuid references auth.users(id),
 created_at timestamptz not null default now(), unique(source_type,source_id)
);
create index if not exists platform_cash_ledger_created_idx on public.platform_cash_ledger(created_at desc);
create index if not exists platform_cash_ledger_category_idx on public.platform_cash_ledger(category,created_at desc);
alter table public.platform_cash_ledger enable row level security;
drop policy if exists "admin reads platform cash ledger" on public.platform_cash_ledger;
create policy "admin reads platform cash ledger" on public.platform_cash_ledger for select to authenticated
using(exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
grant select on public.platform_cash_ledger to authenticated;
alter table public.supplier_payments add column if not exists amount_xof numeric(14,2), add column if not exists treasury_ledger_id uuid references public.platform_cash_ledger(id), add column if not exists payment_category text not null default 'supplier_payment';
alter table public.stores add column if not exists store_settings jsonb not null default '{}'::jsonb, add column if not exists theme_config jsonb not null default '{"primary":"#0B2D5B","accent":"#FF8A00","font":"system"}'::jsonb, add column if not exists custom_domain text, add column if not exists currency text not null default 'XOF', add column if not exists timezone text not null default 'Africa/Lome', add column if not exists plan text not null default 'starter', add column if not exists plan_status text not null default 'active', add column if not exists published_at timestamptz;
alter table public.store_products add column if not exists sku text, add column if not exists barcode text, add column if not exists compare_at_price_xof numeric(14,2), add column if not exists inventory_quantity integer not null default 0, add column if not exists track_inventory boolean not null default true, add column if not exists allow_backorder boolean not null default false, add column if not exists weight_grams integer, add column if not exists seo_title text, add column if not exists seo_description text, add column if not exists tags text[] not null default '{}', add column if not exists variants jsonb not null default '[]'::jsonb, add column if not exists published_at timestamptz;
alter table public.store_members add column if not exists status text not null default 'active', add column if not exists permissions jsonb not null default '{}'::jsonb;
create table if not exists public.store_collections (id uuid primary key default gen_random_uuid(),store_id uuid not null references public.stores(id) on delete cascade,title text not null,slug text not null,description text,image_url text,sort_order integer not null default 0,status text not null default 'active' check(status in ('active','draft','archived')),seo_title text,seo_description text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(store_id,slug));
create table if not exists public.store_collection_products (collection_id uuid not null references public.store_collections(id) on delete cascade,store_product_id uuid not null references public.store_products(id) on delete cascade,sort_order integer not null default 0,primary key(collection_id,store_product_id));
create table if not exists public.store_pages (id uuid primary key default gen_random_uuid(),store_id uuid not null references public.stores(id) on delete cascade,title text not null,slug text not null,content text not null default '',status text not null default 'draft' check(status in ('draft','published','archived')),seo_title text,seo_description text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(store_id,slug));
create table if not exists public.store_discounts (id uuid primary key default gen_random_uuid(),store_id uuid not null references public.stores(id) on delete cascade,code text not null,discount_type text not null check(discount_type in ('percentage','fixed')),value numeric(14,2) not null check(value>0),minimum_order_xof numeric(14,2),usage_limit integer,usage_count integer not null default 0,starts_at timestamptz,ends_at timestamptz,status text not null default 'active' check(status in ('active','paused','expired')),created_at timestamptz not null default now(),unique(store_id,code));
create table if not exists public.store_customers (id uuid primary key default gen_random_uuid(),store_id uuid not null references public.stores(id) on delete cascade,user_id uuid references auth.users(id) on delete set null,full_name text,email text,phone text,tags text[] not null default '{}',notes text,accepts_marketing boolean not null default false,created_at timestamptz not null default now());
create unique index if not exists store_customers_store_user_uidx on public.store_customers(store_id,user_id) where user_id is not null;
create table if not exists public.store_inventory_movements (id uuid primary key default gen_random_uuid(),store_id uuid not null references public.stores(id) on delete cascade,store_product_id uuid not null references public.store_products(id) on delete cascade,movement_type text not null check(movement_type in ('sale','restock','manual_adjustment','return','damage')),quantity_change integer not null,reason text,reference_type text,reference_id uuid,created_by uuid references auth.users(id),created_at timestamptz not null default now());
create index if not exists store_members_user_idx on public.store_members(user_id,status);
create index if not exists store_collections_store_idx on public.store_collections(store_id,status);
create index if not exists store_pages_store_idx on public.store_pages(store_id,status);
create index if not exists store_discounts_store_idx on public.store_discounts(store_id,status);
create index if not exists store_customers_store_idx on public.store_customers(store_id,created_at desc);
create index if not exists store_inventory_movements_product_idx on public.store_inventory_movements(store_product_id,created_at desc);
alter table public.store_members enable row level security;
alter table public.store_collections enable row level security;
alter table public.store_collection_products enable row level security;
alter table public.store_pages enable row level security;
alter table public.store_discounts enable row level security;
alter table public.store_customers enable row level security;
alter table public.store_inventory_movements enable row level security;
drop policy if exists "store owners manage members v2" on public.store_members;
create policy "store owners manage members v2" on public.store_members for all to authenticated using(exists(select 1 from public.stores s where s.id=store_id and s.owner_id=auth.uid())) with check(exists(select 1 from public.stores s where s.id=store_id and s.owner_id=auth.uid()));
drop policy if exists "store owners manage collections" on public.store_collections;
create policy "store owners manage collections" on public.store_collections for all to authenticated using(exists(select 1 from public.stores s where s.id=store_id and s.owner_id=auth.uid())) with check(exists(select 1 from public.stores s where s.id=store_id and s.owner_id=auth.uid()));
drop policy if exists "store owners manage collection products" on public.store_collection_products;
create policy "store owners manage collection products" on public.store_collection_products for all to authenticated using(exists(select 1 from public.store_collections c join public.stores s on s.id=c.store_id where c.id=collection_id and s.owner_id=auth.uid())) with check(exists(select 1 from public.store_collections c join public.stores s on s.id=c.store_id where c.id=collection_id and s.owner_id=auth.uid()));
drop policy if exists "store owners manage pages" on public.store_pages;
create policy "store owners manage pages" on public.store_pages for all to authenticated using(exists(select 1 from public.stores s where s.id=store_id and s.owner_id=auth.uid())) with check(exists(select 1 from public.stores s where s.id=store_id and s.owner_id=auth.uid()));
drop policy if exists "store owners manage discounts" on public.store_discounts;
create policy "store owners manage discounts" on public.store_discounts for all to authenticated using(exists(select 1 from public.stores s where s.id=store_id and s.owner_id=auth.uid())) with check(exists(select 1 from public.stores s where s.id=store_id and s.owner_id=auth.uid()));
drop policy if exists "store owners manage customers" on public.store_customers;
create policy "store owners manage customers" on public.store_customers for all to authenticated using(exists(select 1 from public.stores s where s.id=store_id and s.owner_id=auth.uid())) with check(exists(select 1 from public.stores s where s.id=store_id and s.owner_id=auth.uid()));
drop policy if exists "store owners manage inventory movements" on public.store_inventory_movements;
create policy "store owners manage inventory movements" on public.store_inventory_movements for all to authenticated using(exists(select 1 from public.stores s where s.id=store_id and s.owner_id=auth.uid())) with check(exists(select 1 from public.stores s where s.id=store_id and s.owner_id=auth.uid()));
grant select,insert,update,delete on public.store_members,public.store_collections,public.store_collection_products,public.store_pages,public.store_discounts,public.store_customers,public.store_inventory_movements to authenticated;

create or replace function public.admin_mark_supplier_payment_paid(p_admin_user_id uuid, p_payment_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_payment public.supplier_payments%rowtype; v_balance numeric(14,2); v_ledger_id uuid;
begin
 if not exists(select 1 from public.profiles where id=p_admin_user_id and role='admin') then raise exception 'Accès administrateur requis'; end if;
 select * into v_payment from public.supplier_payments where id=p_payment_id for update;
 if not found then raise exception 'Paiement fournisseur introuvable'; end if;
 if v_payment.status='paid' then return jsonb_build_object('ok',true,'already_paid',true,'ledger_id',v_payment.treasury_ledger_id); end if;
 if v_payment.status<>'due' then raise exception 'Ce paiement ne peut pas être débité dans son état actuel'; end if;
 if coalesce(v_payment.amount_xof,0)<=0 then raise exception 'Renseignez le montant équivalent en FCFA avant de payer le fournisseur'; end if;
 select coalesce(sum(case when direction='credit' then amount_xof else -amount_xof end),0) into v_balance from public.platform_cash_ledger;
 if v_balance<v_payment.amount_xof then raise exception 'Solde ChinaGo insuffisant. Disponible : % FCFA',v_balance; end if;
 insert into public.platform_cash_ledger(direction,category,amount_xof,currency,source_type,source_id,description,created_by)
 values('debit','supplier_payment',v_payment.amount_xof,'XOF','supplier_payment',v_payment.id,'Paiement fournisseur '||v_payment.supplier_name,p_admin_user_id)
 on conflict(source_type,source_id) do nothing returning id into v_ledger_id;
 if v_ledger_id is null then select id into v_ledger_id from public.platform_cash_ledger where source_type='supplier_payment' and source_id=v_payment.id; end if;
 update public.supplier_payments set status='paid',paid_at=now(),treasury_ledger_id=v_ledger_id,updated_at=now() where id=v_payment.id;
 return jsonb_build_object('ok',true,'ledger_id',v_ledger_id,'amount_xof',v_payment.amount_xof);
end; $$;
revoke all on function public.admin_mark_supplier_payment_paid(uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_mark_supplier_payment_paid(uuid,uuid) to service_role;
