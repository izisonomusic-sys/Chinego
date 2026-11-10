alter table public.import_requests
  add column if not exists product_images jsonb not null default '[]'::jsonb,
  add column if not exists product_variants jsonb not null default '[]'::jsonb,
  add column if not exists product_options jsonb not null default '[]'::jsonb,
  add column if not exists minimum_order_quantity integer,
  add column if not exists original_currency text,
  add column if not exists original_price_min numeric,
  add column if not exists original_price_max numeric,
  add column if not exists supplier_company text,
  add column if not exists supplier_contact_name text,
  add column if not exists supplier_phone text,
  add column if not exists supplier_whatsapp text,
  add column if not exists supplier_email text,
  add column if not exists supplier_profile_url text,
  add column if not exists extraction_status text not null default 'manual_review',
  add column if not exists extraction_source text not null default 'manual';

alter table public.import_requests
  add constraint import_requests_minimum_order_quantity_check
  check (minimum_order_quantity is null or minimum_order_quantity > 0);

alter table public.orders add column if not exists tracking_code text;
create sequence if not exists public.chinago_tracking_seq;

create or replace function public.set_chinago_tracking_code()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.tracking_code is null or btrim(new.tracking_code) = '' then
    new.tracking_code := 'CG-' || to_char(now() at time zone 'utc', 'YYMMDD') || '-' ||
      lpad(nextval('public.chinago_tracking_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists set_chinago_tracking_code_before_insert on public.orders;
create trigger set_chinago_tracking_code_before_insert
before insert on public.orders for each row execute function public.set_chinago_tracking_code();

update public.orders
set tracking_code = 'CG-' || to_char(created_at at time zone 'utc', 'YYMMDD') || '-' ||
  upper(substr(replace(id::text, '-', ''), 1, 6))
where tracking_code is null;
create unique index if not exists orders_tracking_code_unique
on public.orders(tracking_code) where tracking_code is not null;

create table if not exists public.supplier_messages (
  id uuid primary key default gen_random_uuid(),
  import_request_id uuid references public.import_requests(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  supplier_name text,
  supplier_whatsapp text,
  channel text not null default 'whatsapp' check (channel in ('whatsapp','email','internal')),
  direction text not null default 'outbound' check (direction in ('outbound','inbound')),
  message_body text not null,
  sent_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.supplier_payments (
  id uuid primary key default gen_random_uuid(),
  import_request_id uuid references public.import_requests(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  supplier_name text not null,
  amount numeric not null check (amount >= 0),
  currency text not null default 'CNY',
  status text not null default 'due' check (status in ('due','paid','cancelled')),
  payment_method text,
  payment_reference text,
  proof_url text,
  paid_at timestamptz,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.supplier_messages enable row level security;
alter table public.supplier_payments enable row level security;

drop policy if exists "Admins manage supplier messages" on public.supplier_messages;
create policy "Admins manage supplier messages" on public.supplier_messages for all to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

drop policy if exists "Admins manage supplier payments" on public.supplier_payments;
create policy "Admins manage supplier payments" on public.supplier_payments for all to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

grant select, insert, update, delete on public.supplier_messages to authenticated;
grant select, insert, update, delete on public.supplier_payments to authenticated;
grant usage, select on sequence public.chinago_tracking_seq to authenticated;

create index if not exists supplier_messages_import_request_idx on public.supplier_messages(import_request_id, created_at desc);
create index if not exists supplier_messages_order_idx on public.supplier_messages(order_id, created_at desc);
create index if not exists supplier_payments_order_idx on public.supplier_payments(order_id, created_at desc);
create index if not exists import_requests_supplier_phone_idx on public.import_requests(supplier_phone);
