begin;
create index if not exists cargo_requests_order_id_idx on public.cargo_requests(order_id);
create index if not exists order_items_product_id_idx on public.order_items(product_id);
create index if not exists orders_cargo_partner_id_idx on public.orders(cargo_partner_id);

grant insert (id, order_number, customer_id, store_id, status, currency, subtotal_xof, shipping_xof, total_xof,
 contact_name, contact_phone, contact_email, delivery_address, delivery_city, customer_notes, cargo_partner_id)
 on public.orders to authenticated;

-- Consolidate SELECT policies to avoid redundant permissive-policy evaluation.
drop policy if exists "Public can view active cargo partners" on public.cargo_partners;
drop policy if exists "Admins manage cargo partners" on public.cargo_partners;
create policy "Public and admins can view cargo partners" on public.cargo_partners
 for select to anon, authenticated
 using (is_active = true or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy "Admins can insert cargo partners" on public.cargo_partners
 for insert to authenticated with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy "Admins can update cargo partners" on public.cargo_partners
 for update to authenticated
 using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
 with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy "Admins can delete cargo partners" on public.cargo_partners
 for delete to authenticated using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

drop policy if exists "Admins can view all cargo requests" on public.cargo_requests;
drop policy if exists "Customers can view their own cargo requests" on public.cargo_requests;
create policy "Customers and admins can view cargo requests" on public.cargo_requests
 for select to authenticated
 using (user_id = (select auth.uid()) or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

drop policy if exists "Admins can view all orders" on public.orders;
drop policy if exists "Customers and store owners can view related orders" on public.orders;
create policy "Related users and admins can view orders" on public.orders
 for select to authenticated using (
  customer_id = (select auth.uid()) or exists (
   select 1 from public.stores s where s.id = store_id and s.owner_id = (select auth.uid())
  ) or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
 );

drop policy if exists "Admins manage products" on public.products;
create policy "Public and admins can view products" on public.products
 for select to anon, authenticated
 using (status = 'active' or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy "Admins can insert products" on public.products
 for insert to authenticated with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy "Admins can update products" on public.products
 for update to authenticated
 using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
 with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy "Admins can delete products" on public.products
 for delete to authenticated using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

drop policy if exists "Admins manage product images" on public.product_images;
create policy "Public and admins can view product images" on public.product_images
 for select to anon, authenticated
 using (
  exists (select 1 from public.products p where p.id = product_id and p.status = 'active')
  or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
 );
create policy "Admins can insert product images" on public.product_images
 for insert to authenticated with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy "Admins can update product images" on public.product_images
 for update to authenticated
 using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
 with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy "Admins can delete product images" on public.product_images
 for delete to authenticated using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
commit;