-- Serialize supplier debits to prevent two concurrent payments spending the same treasury balance.
create or replace function public.admin_mark_supplier_payment_paid(p_admin_user_id uuid, p_payment_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_payment public.supplier_payments%rowtype; v_balance numeric(14,2); v_ledger_id uuid;
begin
 if not exists(select 1 from public.profiles where id=p_admin_user_id and role='admin') then raise exception 'Accès administrateur requis'; end if;
 perform pg_advisory_xact_lock(22801112,1);
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

-- Public storefront read access is limited to published pages/products and active collections.
drop policy if exists "public reads active store collections" on public.store_collections;
create policy "public reads active store collections" on public.store_collections for select to anon,authenticated
using(status='active' and exists(select 1 from public.stores s where s.id=store_id and s.status='active'));
drop policy if exists "public reads published store pages" on public.store_pages;
create policy "public reads published store pages" on public.store_pages for select to anon,authenticated
using(status='published' and exists(select 1 from public.stores s where s.id=store_id and s.status='active'));
drop policy if exists "public reads products in active collections" on public.store_collection_products;
create policy "public reads products in active collections" on public.store_collection_products for select to anon,authenticated
using(exists(select 1 from public.store_collections c join public.stores s on s.id=c.store_id join public.store_products p on p.id=store_product_id where c.id=collection_id and c.status='active' and s.status='active' and p.status='published'));
grant select on public.store_collections,public.store_pages,public.store_collection_products to anon,authenticated;