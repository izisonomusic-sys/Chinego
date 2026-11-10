begin;
alter table public.import_requests
 add column if not exists product_title text,
 add column if not exists product_description text,
 add column if not exists product_image_url text,
 add column if not exists quantity integer not null default 1 check (quantity > 0),
 add column if not exists unit_price_xof numeric(14,2),
 add column if not exists shipping_estimate_xof numeric(14,2),
 add column if not exists admin_notes text,
 add column if not exists quoted_at timestamptz;

drop policy if exists "Users can read their own import requests" on public.import_requests;
create policy "Applicants and admins can read import requests" on public.import_requests
 for select to authenticated
 using (user_id = (select auth.uid()) or exists (
  select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'
 ));
create policy "Admins can update import requests" on public.import_requests
 for update to authenticated
 using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
 with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
grant update (status, product_title, product_description, product_image_url, quantity, unit_price_xof, shipping_estimate_xof, admin_notes, quoted_at)
 on public.import_requests to authenticated;
commit;