begin;
revoke update on public.stores from authenticated;
grant update (name, description, shopify_domain, updated_at) on public.stores to authenticated;
grant update (status, updated_at) on public.stores to authenticated;

drop policy if exists "Public can view active stores" on public.stores;
create policy "Public owners and admins can view stores" on public.stores
 for select to anon, authenticated
 using (
  status = 'active'
  or owner_id = (select auth.uid())
  or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
 );
create policy "Admins can update store status" on public.stores
 for update to authenticated
 using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
 with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

drop policy if exists "Public and owners can view store products" on public.store_products;
create policy "Public owners and admins can view store products" on public.store_products
 for select to anon, authenticated
 using (
  (status = 'published' and exists (select 1 from public.stores s where s.id = store_id and s.status = 'active'))
  or exists (select 1 from public.stores s where s.id = store_id and s.owner_id = (select auth.uid()))
  or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
 );
create policy "Admins can update store products" on public.store_products
 for update to authenticated
 using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
 with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
commit;