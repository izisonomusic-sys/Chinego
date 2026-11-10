begin;

-- Product discovery categories: real taxonomy, no invented product listings.
insert into public.categories (name, slug, description, sort_order, is_active)
values
 ('Électronique','electronique','Téléphones, accessoires et équipements électroniques',1,true),
 ('Maison & cuisine','maison-cuisine','Équipement de la maison et de la cuisine',2,true),
 ('Mode & accessoires','mode-accessoires','Vêtements, chaussures et accessoires',3,true),
 ('Beauté & soins','beaute-soins','Beauté, hygiène et soins personnels',4,true),
 ('Sports & loisirs','sports-loisirs','Sport, fitness et loisirs',5,true),
 ('Auto & moto','auto-moto','Accessoires automobiles et deux-roues',6,true),
 ('Bébé & enfants','bebe-enfants','Articles pour bébés et enfants',7,true),
 ('Outils & bricolage','outils-bricolage','Outils et matériel professionnel',8,true)
on conflict (slug) do nothing;

-- Manual cargo partner directory, ready for carriers without software or API.
create table if not exists public.cargo_partners (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 service_type text not null default 'air' check (service_type in ('air','sea','road','express','mixed')),
 origin_countries text[] not null default array['China']::text[],
 origin_cities text[] not null default '{}',
 destination_countries text[] not null default array['Togo']::text[],
 destination_cities text[] not null default array['Lomé']::text[],
 whatsapp_phone text,
 contact_phone text,
 contact_email text,
 pricing_notes text,
 estimated_days_min integer,
 estimated_days_max integer,
 instructions text,
 is_active boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint cargo_partner_days_check check (
  (estimated_days_min is null or estimated_days_min >= 0) and
  (estimated_days_max is null or estimated_days_max >= 0) and
  (estimated_days_min is null or estimated_days_max is null or estimated_days_max >= estimated_days_min)
 )
);
alter table public.cargo_partners enable row level security;
drop policy if exists "Public can view active cargo partners" on public.cargo_partners;
create policy "Public can view active cargo partners" on public.cargo_partners
 for select to anon, authenticated using (is_active = true);
drop policy if exists "Admins manage cargo partners" on public.cargo_partners;
create policy "Admins manage cargo partners" on public.cargo_partners
 for all to authenticated
 using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
 with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
grant select on public.cargo_partners to anon, authenticated;
grant insert, update, delete on public.cargo_partners to authenticated;

-- Customer order requests: prices are quotations until a payment provider is connected.
alter table public.orders
 add column if not exists contact_name text,
 add column if not exists contact_phone text,
 add column if not exists contact_email text,
 add column if not exists delivery_address text,
 add column if not exists delivery_city text,
 add column if not exists customer_notes text,
 add column if not exists cargo_partner_id uuid references public.cargo_partners(id) on delete set null;

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
 check (status in ('quote_requested','pending','awaiting_payment','paid','processing','shipped','delivered','cancelled','refunded'));

alter table public.order_items
 add column if not exists product_id uuid references public.products(id) on delete set null,
 add column if not exists source_url text;

drop policy if exists "Customers can request their own orders" on public.orders;
create policy "Customers can request their own orders" on public.orders
 for insert to authenticated
 with check (customer_id = (select auth.uid()) and status = 'quote_requested');
drop policy if exists "Admins can view all orders" on public.orders;
create policy "Admins can view all orders" on public.orders
 for select to authenticated
 using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
drop policy if exists "Admins can update orders" on public.orders;
create policy "Admins can update orders" on public.orders
 for update to authenticated
 using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
 with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
grant insert (order_number, customer_id, store_id, status, currency, subtotal_xof, shipping_xof, total_xof,
 contact_name, contact_phone, contact_email, delivery_address, delivery_city, customer_notes, cargo_partner_id)
 on public.orders to authenticated;
grant update (status, shipping_xof, total_xof, updated_at) on public.orders to authenticated;

drop policy if exists "Customers can add items to their own quote orders" on public.order_items;
create policy "Customers can add items to their own quote orders" on public.order_items
 for insert to authenticated
 with check (exists (
  select 1 from public.orders o
  where o.id = order_id and o.customer_id = (select auth.uid()) and o.status = 'quote_requested'
 ));
grant insert (order_id, store_product_id, product_id, product_title, quantity, unit_price_xof, line_total_xof)
 on public.order_items to authenticated;

-- Manual cargo requests. Admin updates statuses and tracking references.
create table if not exists public.cargo_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 order_id uuid references public.orders(id) on delete set null,
 cargo_partner_id uuid not null references public.cargo_partners(id) on delete restrict,
 origin_city text not null,
 destination_city text not null default 'Lomé',
 package_description text not null,
 package_count integer not null default 1 check (package_count > 0),
 weight_kg numeric(10,2),
 dimensions text,
 declared_value_xof numeric(14,2),
 sender_name text not null,
 sender_phone text not null,
 receiver_name text not null,
 receiver_phone text not null,
 receiver_address text not null,
 customer_notes text,
 status text not null default 'submitted'
  check (status in ('submitted','partner_contacted','quoted','accepted','in_transit','arrived','delivered','cancelled')),
 quoted_price_xof numeric(14,2),
 tracking_reference text,
 partner_notes text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint cargo_weight_check check (weight_kg is null or weight_kg > 0),
 constraint cargo_value_check check (declared_value_xof is null or declared_value_xof >= 0)
);
create index if not exists cargo_requests_user_created_idx on public.cargo_requests(user_id, created_at desc);
create index if not exists cargo_requests_partner_status_idx on public.cargo_requests(cargo_partner_id, status);
alter table public.cargo_requests enable row level security;
create policy "Customers can create their own cargo requests" on public.cargo_requests
 for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Customers can view their own cargo requests" on public.cargo_requests
 for select to authenticated using (user_id = (select auth.uid()));
create policy "Admins can view all cargo requests" on public.cargo_requests
 for select to authenticated using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy "Admins can update cargo requests" on public.cargo_requests
 for update to authenticated
 using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
 with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
grant select, insert on public.cargo_requests to authenticated;
grant update (status, quoted_price_xof, tracking_reference, partner_notes, updated_at) on public.cargo_requests to authenticated;

-- Every submitted cargo request creates a notification for its owner.
create or replace function private.notify_chinago_cargo_request()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
 insert into public.notifications(user_id, title, body, kind)
 values (new.user_id, 'Demande cargo enregistrée',
  'Votre demande de transport a été enregistrée. Vous pouvez contacter le transporteur via WhatsApp et suivre la mise à jour depuis votre espace.',
  'order');
 return new;
end;
$$;
revoke all on function private.notify_chinago_cargo_request() from public, anon, authenticated;
drop trigger if exists notify_chinago_cargo_request on public.cargo_requests;
create trigger notify_chinago_cargo_request after insert on public.cargo_requests
 for each row execute function private.notify_chinago_cargo_request();

commit;