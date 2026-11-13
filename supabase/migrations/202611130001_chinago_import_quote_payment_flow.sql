alter table public.import_requests add column if not exists order_id uuid references public.orders(id) on delete set null;
alter table public.import_requests drop constraint if exists import_requests_source_platform_check;
alter table public.import_requests add constraint import_requests_source_platform_check check (source_platform in ('alibaba','aliexpress','amazon','ebay','other'));
create unique index if not exists import_requests_order_id_unique on public.import_requests(order_id) where order_id is not null;
create or replace function public.accept_import_quote(p_import_request_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_request public.import_requests%rowtype; v_order_id uuid:=gen_random_uuid();
 v_number text:='CG-'||upper(substr(replace(v_order_id::text,'-',''),1,10));
 v_subtotal numeric(14,2); v_shipping numeric(14,2); v_total numeric(14,2);
 v_tracking text:='CGT-'||upper(substr(replace(v_order_id::text,'-',''),1,12));
begin
 if v_user is null then raise exception 'Connectez-vous pour accepter ce devis.'; end if;
 select * into v_request from public.import_requests where id=p_import_request_id and user_id=v_user for update;
 if not found then raise exception 'Demande d’importation introuvable.'; end if;
 if v_request.order_id is not null then return v_request.order_id; end if;
 if v_request.status<>'quoted' then raise exception 'Le devis ChinaGo n’est pas encore prêt.'; end if;
 if v_request.unit_price_xof is null or v_request.unit_price_xof<=0 then raise exception 'Le prix unitaire doit être confirmé par ChinaGo.'; end if;
 v_subtotal:=round(v_request.unit_price_xof*v_request.quantity,0);
 v_shipping:=greatest(0,coalesce(v_request.shipping_estimate_xof,0)); v_total:=v_subtotal+v_shipping;
 insert into public.orders(id,order_number,customer_id,status,currency,subtotal_xof,shipping_xof,total_xof,contact_name,contact_phone,delivery_address,delivery_city,customer_notes,tracking_code)
 values(v_order_id,v_number,v_user,'awaiting_payment','XOF',v_subtotal,v_shipping,v_total,coalesce(v_request.customer_contact_name,''),coalesce(v_request.customer_phone,''),
 concat_ws(', ',v_request.delivery_street,v_request.delivery_neighborhood,v_request.delivery_city,v_request.delivery_country),v_request.delivery_city,
 concat_ws(E'\n','Importation ChinaGo: '||coalesce(v_request.product_title,'Produit'),'WhatsApp: '||coalesce(v_request.customer_whatsapp,''),v_request.delivery_instructions),v_tracking);
 insert into public.order_items(order_id,product_title,quantity,unit_price_xof,line_total_xof,source_url)
 values(v_order_id,coalesce(v_request.product_title,'Produit importé'),v_request.quantity,round(v_request.unit_price_xof,0),v_subtotal,v_request.source_url);
 update public.import_requests set order_id=v_order_id,status='converted' where id=v_request.id;
 insert into public.notifications(user_id,title,body,kind)
 values(v_user,'Devis accepté – paiement disponible','Votre commande '||v_number||' est créée. Suivez-la avec le numéro '||v_tracking||' et procédez au paiement depuis votre espace ChinaGo.','order');
 return v_order_id;
end; $$;
revoke all on function public.accept_import_quote(uuid) from public,anon;
grant execute on function public.accept_import_quote(uuid) to authenticated;