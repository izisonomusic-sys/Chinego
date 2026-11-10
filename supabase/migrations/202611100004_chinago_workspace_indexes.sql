create index if not exists order_items_store_product_id_idx on public.order_items(store_product_id);
create index if not exists product_favorites_product_id_idx on public.product_favorites(product_id);
create index if not exists store_products_product_id_idx on public.store_products(product_id);

drop policy if exists "Public can view published products in active stores" on public.store_products;
drop policy if exists "Store owners can view all their store products" on public.store_products;
create policy "Public and owners can view store products" on public.store_products
for select to anon, authenticated
using (
  (status = 'published' and exists (select 1 from public.stores s where s.id = store_id and s.status = 'active'))
  or exists (select 1 from public.stores s where s.id = store_id and s.owner_id = (select auth.uid()))
);