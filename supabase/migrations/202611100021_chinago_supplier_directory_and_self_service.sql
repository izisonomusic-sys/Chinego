-- ChinaGo: self-service seller onboarding, supplier directory, product specs and AI supplier messaging.
alter table public.products
  add column if not exists sku text,
  add column if not exists brand text,
  add column if not exists model_number text,
  add column if not exists origin_country text,
  add column if not exists material text,
  add column if not exists color text,
  add column if not exists size text,
  add column if not exists stock_quantity integer,
  add column if not exists product_condition text,
  add column if not exists package_dimensions text,
  add column if not exists package_weight numeric(12,3),
  add column if not exists warranty text,
  add column if not exists certifications text[] not null default '{}',
  add column if not exists product_specs jsonb not null default '{}'::jsonb,
  add column if not exists supplier_contact_id uuid;

create table if not exists public.supplier_contacts (
  id uuid primary key default gen_random_uuid(), company_name text not null,
  contact_name text, email text, phone text, whatsapp text,
  country text not null default 'China', website_url text, payment_method text,
  payment_account_name text, payment_account_number text, payment_bank text,
  payment_wallet text, payment_currency text not null default 'CNY',
  whatsapp_opt_in boolean not null default false,
  status text not null default 'active' check (status in ('active','inactive')),
  notes text, created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.supplier_contacts add column if not exists supplier_application_id uuid unique references public.supplier_applications(id) on delete set null;
alter table public.products drop constraint if exists products_supplier_contact_id_fkey;
alter table public.products add constraint products_supplier_contact_id_fkey foreign key (supplier_contact_id) references public.supplier_contacts(id) on delete set null;
alter table public.supplier_payments add column if not exists supplier_contact_id uuid references public.supplier_contacts(id) on delete set null;

create table if not exists public.supplier_order_messages (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
  supplier_contact_id uuid not null references public.supplier_contacts(id) on delete restrict,
  supplier_name text not null, supplier_whatsapp text, message_body text not null,
  ai_generated boolean not null default false,
  status text not null default 'awaiting_configuration' check (status in ('awaiting_configuration','ready','sent','failed')),
  error_message text, provider_message_id text, created_at timestamptz not null default now(), sent_at timestamptz,
  unique(order_id,supplier_contact_id)
);
alter table public.supplier_contacts enable row level security;
alter table public.supplier_order_messages enable row level security;
drop policy if exists "Admins manage supplier contacts" on public.supplier_contacts;
create policy "Admins manage supplier contacts" on public.supplier_contacts for all to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'))
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
drop policy if exists "Admins manage supplier order messages" on public.supplier_order_messages;
create policy "Admins manage supplier order messages" on public.supplier_order_messages for all to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'))
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
grant select,insert,update,delete on public.supplier_contacts,public.supplier_order_messages to authenticated;
grant select,insert,update,delete on public.supplier_contacts,public.supplier_order_messages to service_role;

drop policy if exists "Store owners can create their own stores" on public.stores;
drop policy if exists "Approved sellers can create their own stores" on public.stores;
create policy "Authenticated users can create their own active stores" on public.stores
for insert to authenticated with check (owner_id=(select auth.uid()) and status='active');
create or replace function public.activate_business_account_on_application()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  update public.profiles
  set role = case when tg_table_name='seller_applications'
    then case when new.account_type='dropshipper' then 'dropshipper' else 'seller' end
    else 'supplier' end,
    updated_at=now()
  where id=new.user_id;
  new.status := 'approved';
  if tg_table_name='supplier_applications' then
    insert into public.supplier_contacts(
      supplier_application_id,company_name,contact_name,email,phone,country,website_url,notes,created_by
    ) values (
      new.id,new.company_name,new.contact_name,new.email,new.phone,new.country,new.website_url,new.message,new.user_id
    ) on conflict (supplier_application_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.activate_business_account_on_application() from public, anon, authenticated;
drop trigger if exists activate_seller_account_after_application on public.seller_applications;
create trigger activate_seller_account_after_application before insert on public.seller_applications
for each row execute function public.activate_business_account_on_application();
drop trigger if exists activate_supplier_account_after_application on public.supplier_applications;
create trigger activate_supplier_account_after_application before insert on public.supplier_applications
for each row execute function public.activate_business_account_on_application();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('chinago-product-images','chinago-product-images',true,10485760,array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set public=true,file_size_limit=10485760,allowed_mime_types=array['image/jpeg','image/png','image/webp','image/avif'];
drop policy if exists "Admins upload ChinaGo product images" on storage.objects;
create policy "Admins upload ChinaGo product images" on storage.objects for insert to authenticated
with check (bucket_id='chinago-product-images' and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
drop policy if exists "Admins update ChinaGo product images" on storage.objects;
create policy "Admins update ChinaGo product images" on storage.objects for update to authenticated
using (bucket_id='chinago-product-images' and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'))
with check (bucket_id='chinago-product-images' and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
drop policy if exists "Admins delete ChinaGo product images" on storage.objects;
create policy "Admins delete ChinaGo product images" on storage.objects for delete to authenticated
using (bucket_id='chinago-product-images' and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));

update public.seller_applications set status='approved' where status='pending';
update public.supplier_applications set status='approved' where status='pending';
update public.profiles p set role=case when a.account_type='dropshipper' then 'dropshipper' else 'seller' end,updated_at=now()
from (select distinct on(user_id) user_id,account_type from public.seller_applications order by user_id,created_at desc) a
where p.id=a.user_id and p.role<>'admin';
update public.profiles p set role='supplier',updated_at=now()
from (select distinct on(user_id) user_id from public.supplier_applications order by user_id,created_at desc) a
where p.id=a.user_id and p.role<>'admin';
update public.stores set status='active',updated_at=now() where status='draft';

insert into public.supplier_contacts(supplier_application_id,company_name,contact_name,email,phone,country,website_url,notes,created_by)
select s.id,s.company_name,s.contact_name,s.email,s.phone,s.country,s.website_url,s.message,s.user_id
from public.supplier_applications s
where not exists(select 1 from public.supplier_contacts c where c.supplier_application_id=s.id)
on conflict (supplier_application_id) do nothing;
