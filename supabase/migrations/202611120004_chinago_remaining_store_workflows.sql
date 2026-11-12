
-- ChinaGo: multi-product storefront checkout, inventory, seller wallet and staff access.
create schema if not exists private;
grant usage on schema private to authenticated;

alter table public.stores
  add column if not exists custom_domain_status text not null default 'not_configured',
  add column if not exists custom_domain_verified_at timestamptz;
create unique index if not exists stores_custom_domain_unique
  on public.stores(lower(custom_domain))
  where custom_domain is not null and length(trim(custom_domain)) > 0;

alter table public.store_members
  add column if not exists invited_by uuid references auth.users(id),
  add column if not exists updated_at timestamptz not null default now();

create or replace function private.has_store_permission(p_store_id uuid,p_permission text)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(select 1 from public.stores s where s.id=p_store_id and s.owner_id=(select auth.uid()))
  or exists(select 1 from public.store_members sm where sm.store_id=p_store_id and sm.user_id=(select auth.uid())
    and sm.status='active' and coalesce((sm.permissions->>p_permission)::boolean,false));
$$;
revoke all on function private.has_store_permission(uuid,text) from public,anon;
grant execute on function private.has_store_permission(uuid,text) to authenticated;

drop policy if exists "store members can view their store" on public.stores;
create policy "store members can view their store" on public.stores for select to authenticated
using(exists(select 1 from public.store_members sm where sm.store_id=stores.id and sm.user_id=(select auth.uid()) and sm.status='active'));

create unique index if not exists wallet_accounts_store_unique on public.wallet_accounts(store_id) where store_id is not null;
create or replace function public.ensure_store_wallet()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  insert into public.wallet_accounts(owner_user_id,store_id,account_type,currency,status)
  values(new.owner_id,new.id,'seller',coalesce(new.currency,'XOF'),'active') on conflict do nothing;
  return new;
end;
$$;
drop trigger if exists trg_ensure_store_wallet on public.stores;
create trigger trg_ensure_store_wallet after insert on public.stores for each row execute function public.ensure_store_wallet();
insert into public.wallet_accounts(owner_user_id,store_id,account_type,currency,status)
select s.owner_id,s.id,'seller',coalesce(s.currency,'XOF'),'active' from public.stores s
where not exists(select 1 from public.wallet_accounts w where w.store_id=s.id) on conflict do nothing;

create or replace function public.create_store_cart_order(
 p_store_id uuid,p_items jsonb,p_contact_name text,p_contact_phone text,p_contact_email text,
 p_delivery_address text,p_delivery_city text,p_customer_notes text default null
) returns uuid language plpgsql security definer set search_path=''
as $$
declare
 v_user uuid:=auth.uid(); v_order uuid:=gen_random_uuid(); v_number text:='CG-'||upper(substr(replace(v_order::text,'-',''),1,10));
 v_item jsonb; v_product public.store_products%rowtype; v_qty integer; v_subtotal numeric(14,2):=0; v_line numeric(14,2); v_count integer:=0;
begin
 if v_user is null then raise exception 'Authentification requise'; end if;
 if not exists(select 1 from public.stores where id=p_store_id and status='active') then raise exception 'Boutique indisponible'; end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Le panier est vide'; end if;
 if nullif(trim(coalesce(p_contact_name,'')),'') is null or nullif(trim(coalesce(p_contact_phone,'')),'') is null then raise exception 'Nom et téléphone requis'; end if;
 insert into public.orders(id,order_number,customer_id,store_id,status,currency,subtotal_xof,shipping_xof,total_xof,contact_name,contact_phone,contact_email,delivery_address,delivery_city,customer_notes)
 values(v_order,v_number,v_user,p_store_id,'quote_requested','XOF',0,0,0,trim(p_contact_name),trim(p_contact_phone),nullif(trim(coalesce(p_contact_email,'')),''),
 trim(coalesce(p_delivery_address,'')),trim(coalesce(p_delivery_city,'Lomé')),nullif(trim(coalesce(p_customer_notes,'')),''));
 for v_item in select value from jsonb_array_elements(p_items) loop
   v_qty:=greatest(1,least(1000,coalesce((v_item->>'quantity')::integer,1)));
   select * into v_product from public.store_products where id=(v_item->>'product_id')::uuid and store_id=p_store_id and status='published' for update;
   if not found then raise exception 'Un produit du panier n’est plus disponible'; end if;
   if v_product.track_inventory and not v_product.allow_backorder then
     update public.store_products set inventory_quantity=inventory_quantity-v_qty,updated_at=now()
     where id=v_product.id and inventory_quantity>=v_qty;
     if not found then raise exception 'Stock insuffisant pour : %',v_product.title; end if;
   elsif v_product.track_inventory then
     update public.store_products set inventory_quantity=greatest(0,inventory_quantity-v_qty),updated_at=now() where id=v_product.id;
   end if;
   v_line:=coalesce(v_product.selling_price_xof,0)*v_qty; v_subtotal:=v_subtotal+v_line;
   insert into public.order_items(order_id,store_product_id,product_title,quantity,unit_price_xof,line_total_xof,source_url)
   values(v_order,v_product.id,v_product.title,v_qty,coalesce(v_product.selling_price_xof,0),v_line,v_product.source_url);
   insert into public.store_inventory_movements(store_product_id,store_id,movement_type,quantity_change,reason,reference_id)
   values(v_product.id,p_store_id,'sale',-v_qty,'sale_reservation',v_order);
   v_count:=v_count+1;
 end loop;
 if v_count=0 then raise exception 'Le panier est vide'; end if;
 update public.orders set subtotal_xof=v_subtotal,total_xof=v_subtotal,updated_at=now() where id=v_order;
 return v_order;
end;
$$;
revoke all on function public.create_store_cart_order(uuid,jsonb,text,text,text,text,text,text) from public,anon;
grant execute on function public.create_store_cart_order(uuid,jsonb,text,text,text,text,text,text) to authenticated;

create or replace function public.request_wallet_payout(
 p_wallet_account_id uuid,p_amount numeric,p_payout_method text,p_beneficiary_name text,
 p_beneficiary_phone text default null,p_beneficiary_account text default null,p_beneficiary_bank text default null
) returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_wallet public.wallet_accounts%rowtype; v_id uuid:=gen_random_uuid();
begin
 if v_user is null then raise exception 'Authentification requise'; end if;
 if p_amount is null or p_amount<1000 then raise exception 'Le retrait minimum est de 1 000 FCFA'; end if;
 if nullif(trim(coalesce(p_payout_method,'')),'') is null or nullif(trim(coalesce(p_beneficiary_name,'')),'') is null then raise exception 'Moyen de retrait et bénéficiaire requis'; end if;
 select * into v_wallet from public.wallet_accounts where id=p_wallet_account_id and owner_user_id=v_user and status='active' for update;
 if not found then raise exception 'Portefeuille introuvable'; end if;
 if v_wallet.available_balance<p_amount then raise exception 'Solde disponible insuffisant'; end if;
 update public.wallet_accounts set available_balance=available_balance-p_amount,updated_at=now() where id=v_wallet.id;
 insert into public.payout_requests(id,wallet_account_id,user_id,amount,currency,payout_method,beneficiary_name,beneficiary_phone,beneficiary_account,beneficiary_bank,status,destination_type,destination_name,destination_account,destination_provider)
 values(v_id,v_wallet.id,v_user,p_amount,v_wallet.currency,trim(p_payout_method),trim(p_beneficiary_name),nullif(trim(coalesce(p_beneficiary_phone,'')),''),
 nullif(trim(coalesce(p_beneficiary_account,'')),''),nullif(trim(coalesce(p_beneficiary_bank,'')),''),'requested',trim(p_payout_method),trim(p_beneficiary_name),
 nullif(trim(coalesce(p_beneficiary_account,'')),''),trim(p_payout_method));
 insert into public.wallet_ledger(wallet_account_id,user_id,entry_type,direction,amount,currency,reference_type,reference_id,description)
 values(v_wallet.id,v_user,'payout_hold','debit',p_amount,v_wallet.currency,'payout_request',v_id,'Montant réservé pour une demande de retrait');
 return v_id;
end;
$$;
revoke all on function public.request_wallet_payout(uuid,numeric,text,text,text,text,text) from public,anon;
grant execute on function public.request_wallet_payout(uuid,numeric,text,text,text,text,text) to authenticated;
drop policy if exists "payout owner requests own" on public.payout_requests;
drop policy if exists "wallet owner creates own payout requests" on public.payout_requests;
revoke insert on public.payout_requests from anon,authenticated;

create or replace function public.sync_wallet_payout_status(p_payout_request_id uuid,p_status text,p_provider_reference text default null)
returns void language plpgsql security definer set search_path=''
as $$
declare v_request public.payout_requests%rowtype;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Accès service requis'; end if;
 if p_status not in ('processing','paid','rejected') then raise exception 'Statut fournisseur invalide'; end if;
 select * into v_request from public.payout_requests where id=p_payout_request_id for update;
 if not found then raise exception 'Demande de retrait introuvable'; end if;
 if v_request.status in ('paid','rejected','failed','cancelled') then return; end if;
 update public.payout_requests set status=p_status,provider='PayDunya',provider_reference=coalesce(p_provider_reference,provider_reference),
 processed_at=case when p_status in ('paid','rejected') then now() else processed_at end where id=v_request.id;
 if p_status='rejected' then
   update public.wallet_accounts set available_balance=available_balance+v_request.amount,updated_at=now() where id=v_request.wallet_account_id;
   insert into public.wallet_ledger(wallet_account_id,user_id,entry_type,direction,amount,currency,reference_type,reference_id,description)
   values(v_request.wallet_account_id,v_request.user_id,'payout_release','credit',v_request.amount,v_request.currency,'payout_request',v_request.id,'Remboursement automatique après échec du décaissement');
 elsif p_status='paid' then
   update public.wallet_ledger set entry_type='payout_release',description='Retrait effectué par PayDunya'
   where wallet_account_id=v_request.wallet_account_id and reference_type='payout_request' and reference_id=v_request.id and entry_type='payout_hold';
 end if;
end;
$$;
revoke all on function public.sync_wallet_payout_status(uuid,text,text) from public,anon,authenticated;
grant execute on function public.sync_wallet_payout_status(uuid,text,text) to service_role;

create or replace function public.manage_store_member(p_store_id uuid,p_member_user_id uuid,p_permissions jsonb,p_status text default 'active')
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_id uuid;
begin
 if not exists(select 1 from public.stores where id=p_store_id and owner_id=auth.uid()) then raise exception 'Seul le propriétaire peut gérer le personnel'; end if;
 if p_member_user_id is null or p_member_user_id=auth.uid() then raise exception 'Compte membre invalide'; end if;
 if not exists(select 1 from public.profiles where id=p_member_user_id) then raise exception 'Utilisateur ChinaGo introuvable'; end if;
 if p_status not in ('active','revoked') then raise exception 'Statut invalide'; end if;
 if jsonb_typeof(coalesce(p_permissions,'{}'::jsonb))<>'object' then raise exception 'Permissions invalides'; end if;
 insert into public.store_members(store_id,user_id,member_role,status,permissions,invited_by,updated_at)
 values(p_store_id,p_member_user_id,'manager',p_status,coalesce(p_permissions,'{}'::jsonb),auth.uid(),now())
 on conflict(store_id,user_id) do update set status=excluded.status,permissions=excluded.permissions,updated_at=now()
 returning id into v_id;
 return v_id;
end;
$$;
revoke all on function public.manage_store_member(uuid,uuid,jsonb,text) from public,anon;
grant execute on function public.manage_store_member(uuid,uuid,jsonb,text) to authenticated;

create or replace function public.update_store_order_status(p_order_id uuid,p_status text)
returns void language plpgsql security definer set search_path=''
as $$
declare v_order public.orders%rowtype;
begin
 select * into v_order from public.orders where id=p_order_id for update;
 if not found then raise exception 'Commande introuvable'; end if;
 if not private.has_store_permission(v_order.store_id,'manage_orders') then raise exception 'Permission de gestion des commandes requise'; end if;
 if p_status not in ('processing','shipped','delivered','cancelled') then raise exception 'Statut non autorisé'; end if;
 if v_order.status in ('delivered','cancelled') then raise exception 'Cette commande est déjà clôturée'; end if;
 if p_status in ('processing','shipped','delivered') and not exists(select 1 from public.payment_transactions pt where pt.order_id=v_order.id and pt.status='confirmed') then
   raise exception 'La commande doit avoir un paiement confirmé avant son traitement ou sa livraison';
 end if;
 update public.orders set status=p_status,updated_at=now() where id=p_order_id;
end;
$$;
revoke all on function public.update_store_order_status(uuid,text) from public,anon;
grant execute on function public.update_store_order_status(uuid,text) to authenticated;

create or replace function public.update_store_product_inventory(p_product_id uuid,p_quantity integer)
returns void language plpgsql security definer set search_path=''
as $$
declare v_product public.store_products%rowtype; v_delta integer;
begin
 select * into v_product from public.store_products where id=p_product_id for update;
 if not found then raise exception 'Produit introuvable'; end if;
 if not private.has_store_permission(v_product.store_id,'manage_inventory') then raise exception 'Permission de gestion du stock requise'; end if;
 if p_quantity<0 or p_quantity>1000000 then raise exception 'Quantité de stock invalide'; end if;
 v_delta:=p_quantity-v_product.inventory_quantity;
 update public.store_products set inventory_quantity=p_quantity,track_inventory=true,updated_at=now() where id=p_product_id;
 if v_delta<>0 then insert into public.store_inventory_movements(store_product_id,store_id,movement_type,quantity_change,reason) values(p_product_id,v_product.store_id,'manual_adjustment',v_delta,'manual_adjustment'); end if;
end;
$$;
revoke all on function public.update_store_product_inventory(uuid,integer) from public,anon;
grant execute on function public.update_store_product_inventory(uuid,integer) to authenticated;

create or replace function public.restore_store_inventory_on_cancel()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_item record;
begin
 if new.status='cancelled' and old.status is distinct from 'cancelled' then
  for v_item in select oi.store_product_id,oi.quantity from public.order_items oi where oi.order_id=new.id and oi.store_product_id is not null loop
   update public.store_products set inventory_quantity=inventory_quantity+v_item.quantity,updated_at=now() where id=v_item.store_product_id and track_inventory=true;
   insert into public.store_inventory_movements(store_product_id,store_id,movement_type,quantity_change,reason,reference_id)
   select sp.id,sp.store_id,'return',v_item.quantity,'sale_cancelled',new.id from public.store_products sp where sp.id=v_item.store_product_id;
  end loop;
 end if;
 return new;
end;
$$;
drop trigger if exists trg_restore_store_inventory_on_cancel on public.orders;
create trigger trg_restore_store_inventory_on_cancel after update of status on public.orders for each row execute function public.restore_store_inventory_on_cancel();

create or replace function public.credit_store_wallet_on_delivery()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_wallet public.wallet_accounts%rowtype; v_earning numeric(14,2); v_rate numeric:=0; v_ledger_id uuid;
begin
 if new.status='delivered' and old.status is distinct from new.status and new.store_id is not null
 and exists(select 1 from public.payment_transactions pt where pt.order_id=new.id and pt.status='confirmed') then
  select * into v_wallet from public.wallet_accounts where store_id=new.store_id and status='active' limit 1;
  if not found then return new; end if;
  select greatest(0,coalesce(sum((oi.unit_price_xof-coalesce(sp.cost_price_xof,oi.unit_price_xof))*oi.quantity),0)) into v_earning
  from public.order_items oi left join public.store_products sp on sp.id=oi.store_product_id
  where oi.order_id=new.id and oi.store_product_id is not null;
  select coalesce(nullif(s.store_settings->>'commission_rate_percent','')::numeric,0) into v_rate from public.stores s where s.id=new.store_id;
  v_earning:=greatest(0,round(v_earning*(1-least(100,greatest(0,v_rate))/100),2));
  if v_earning>0 then
   insert into public.wallet_ledger(wallet_account_id,user_id,entry_type,direction,amount,currency,reference_type,reference_id,description)
   values(v_wallet.id,v_wallet.owner_user_id,'sale_available','credit',v_earning,v_wallet.currency,'order',new.id,'Marge vendeur sur commande livrée')
   on conflict do nothing returning id into v_ledger_id;
   if v_ledger_id is not null then update public.wallet_accounts set available_balance=available_balance+v_earning,updated_at=now() where id=v_wallet.id; end if;
  end if;
 end if;
 return new;
end;
$$;
drop trigger if exists trg_credit_store_wallet_on_delivery on public.orders;
create trigger trg_credit_store_wallet_on_delivery after update of status on public.orders for each row execute function public.credit_store_wallet_on_delivery();

create unique index if not exists wallet_ledger_order_sale_available_once on public.wallet_ledger(wallet_account_id,reference_type,reference_id,entry_type)
where reference_type='order' and entry_type='sale_available';

drop policy if exists "staff can read permitted store products" on public.store_products;
create policy "staff can read permitted store products" on public.store_products for select to authenticated
using(private.has_store_permission(store_id,'view_products') or private.has_store_permission(store_id,'manage_products'));
drop policy if exists "staff can manage permitted store products" on public.store_products;
create policy "staff can manage permitted store products" on public.store_products for all to authenticated
using(private.has_store_permission(store_id,'manage_products')) with check(private.has_store_permission(store_id,'manage_products'));

drop policy if exists "staff can read permitted collections" on public.store_collections;
create policy "staff can read permitted collections" on public.store_collections for select to authenticated
using(private.has_store_permission(store_id,'view_products') or private.has_store_permission(store_id,'manage_products'));
drop policy if exists "staff can manage permitted collections" on public.store_collections;
create policy "staff can manage permitted collections" on public.store_collections for all to authenticated
using(private.has_store_permission(store_id,'manage_products')) with check(private.has_store_permission(store_id,'manage_products'));

drop policy if exists "staff can manage permitted pages" on public.store_pages;
create policy "staff can manage permitted pages" on public.store_pages for all to authenticated
using(private.has_store_permission(store_id,'manage_pages')) with check(private.has_store_permission(store_id,'manage_pages'));
drop policy if exists "staff can manage permitted discounts" on public.store_discounts;
create policy "staff can manage permitted discounts" on public.store_discounts for all to authenticated
using(private.has_store_permission(store_id,'manage_discounts')) with check(private.has_store_permission(store_id,'manage_discounts'));

drop policy if exists "staff can read store orders" on public.orders;
create policy "staff can read store orders" on public.orders for select to authenticated
using(private.has_store_permission(store_id,'view_orders') or private.has_store_permission(store_id,'manage_orders'));
drop policy if exists "staff can read store order items" on public.order_items;
create policy "staff can read store order items" on public.order_items for select to authenticated
using(exists(select 1 from public.orders o where o.id=order_items.order_id and
(private.has_store_permission(o.store_id,'view_orders') or private.has_store_permission(o.store_id,'manage_orders'))));

drop policy if exists "staff can read store inventory movements" on public.store_inventory_movements;
create policy "staff can read store inventory movements" on public.store_inventory_movements for select to authenticated
using(private.has_store_permission(store_id,'manage_inventory'));

revoke all on function public.ensure_store_wallet() from public,anon,authenticated;
revoke all on function public.credit_store_wallet_on_delivery() from public,anon,authenticated;
revoke all on function public.restore_store_inventory_on_cancel() from public,anon,authenticated;
revoke all on function public.admin_process_wallet_payout(uuid,text,text,text) from public,anon,authenticated;
