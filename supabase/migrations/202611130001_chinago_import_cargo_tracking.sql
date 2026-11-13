-- ChinaGo import purchase and cargo tracking workflow
create unique index if not exists cargo_requests_one_per_order
on public.cargo_requests(order_id) where order_id is not null;

create or replace function private.create_import_cargo_after_payment()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  v_import public.import_requests%rowtype;
  v_order public.orders%rowtype;
  v_cargo_id uuid;
  v_variant_text text;
begin
  if new.status <> 'confirmed' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'confirmed' then return new; end if;
  select * into v_import from public.import_requests where order_id = new.order_id limit 1;
  if not found then return new; end if;
  select * into v_order from public.orders where id = new.order_id;
  if not found then return new; end if;
  v_variant_text := concat_ws(', ',
    nullif(v_import.selected_options->>'color',''),
    nullif(v_import.selected_options->>'size',''),
    nullif(v_import.selected_options->'options'::text,'{}')
  );
  insert into public.cargo_requests(
    user_id,order_id,origin_city,destination_city,package_description,package_count,
    sender_name,sender_phone,receiver_name,receiver_phone,receiver_address,customer_notes,status
  )
  values(
    v_import.user_id,v_order.id,
    case when v_import.source_platform in ('alibaba','aliexpress') then 'Chine - ville à confirmer' else 'Origine à confirmer' end,
    coalesce(nullif(v_import.delivery_city,''),'Lomé'),
    coalesce(v_import.product_title,'Produit importé') || ' × ' || v_import.quantity ||
      case when v_variant_text <> '' then ' (' || v_variant_text || ')' else '' end,
    1,
    coalesce(nullif(v_import.supplier_company,''),nullif(v_import.supplier_contact_name,''),'Fournisseur à identifier'),
    coalesce(nullif(v_import.supplier_phone,''),nullif(v_import.supplier_whatsapp,''),'Coordonnée à confirmer'),
    coalesce(nullif(v_import.customer_contact_name,''),v_order.contact_name,'Client ChinaGo'),
    coalesce(nullif(v_import.customer_whatsapp,''),nullif(v_import.customer_phone,''),v_order.contact_phone,''),
    concat_ws(', ',nullif(v_import.delivery_street,''),nullif(v_import.delivery_neighborhood,''),nullif(v_import.delivery_city,''),nullif(v_import.delivery_country,'')),
    concat_ws(E'\n','Commande ChinaGo ' || v_order.order_number,nullif(v_import.delivery_instructions,'')),
    'submitted'
  )
  on conflict (order_id) where order_id is not null do nothing
  returning id into v_cargo_id;
  if v_cargo_id is not null then
    insert into public.notifications(user_id,title,body,kind)
    values(v_import.user_id,'Suivi ChinaGo créé',
      'Votre paiement est confirmé pour la commande ' || v_order.order_number ||
      '. Votre référence ChinaGo est ' || coalesce(v_order.tracking_code,'en cours de création') ||
      '. Votre dossier de transport est ouvert. Les prochaines étapes apparaîtront dans votre espace Cargo.','cargo');
  end if;
  return new;
end;
$$;
revoke all on function private.create_import_cargo_after_payment() from public,anon,authenticated;
drop trigger if exists trg_create_import_cargo_after_payment on public.payment_transactions;
create trigger trg_create_import_cargo_after_payment
after insert or update of status on public.payment_transactions
for each row execute function private.create_import_cargo_after_payment();

create or replace function public.accept_import_quote(p_import_request_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare
 v_user uuid:=auth.uid();
 v_request public.import_requests%rowtype;
 v_order_id uuid:=gen_random_uuid();
 v_number text:='CG-'||upper(substr(replace(v_order_id::text,'-',''),1,10));
 v_subtotal numeric(14,2);
 v_shipping numeric(14,2);
 v_total numeric(14,2);
 v_tracking text:='CGT-'||upper(substr(replace(v_order_id::text,'-',''),1,12));
 v_options text;
begin
 if v_user is null then raise exception 'Connectez-vous pour accepter ce devis.'; end if;
 select * into v_request from public.import_requests where id=p_import_request_id and user_id=v_user for update;
 if not found then raise exception 'Demande d’importation introuvable.'; end if;
 if v_request.order_id is not null then return v_request.order_id; end if;
 if v_request.status<>'quoted' then raise exception 'Le devis ChinaGo n’est pas encore prêt.'; end if;
 if v_request.unit_price_xof is null or v_request.unit_price_xof<=0 then raise exception 'Le prix unitaire doit être confirmé par ChinaGo.'; end if;
 if v_request.quantity<1 then raise exception 'Quantité invalide.'; end if;
 v_subtotal:=round(v_request.unit_price_xof*v_request.quantity,0);
 v_shipping:=greatest(0,coalesce(v_request.shipping_estimate_xof,0));
 v_total:=v_subtotal+v_shipping;
 v_options:=concat_ws(', ',
   nullif(v_request.selected_options->>'color',''),
   nullif(v_request.selected_options->>'size',''),
   nullif(v_request.selected_options->'options'::text,'{}')
 );
 insert into public.orders(id,order_number,customer_id,status,currency,subtotal_xof,shipping_xof,total_xof,
  contact_name,contact_phone,delivery_address,delivery_city,customer_notes,tracking_code)
 values(v_order_id,v_number,v_user,'awaiting_payment','XOF',v_subtotal,v_shipping,v_total,
  coalesce(v_request.customer_contact_name,''),coalesce(v_request.customer_phone,''),
  concat_ws(', ',v_request.delivery_street,v_request.delivery_neighborhood,v_request.delivery_city,v_request.delivery_country),
  v_request.delivery_city,
  concat_ws(E'\n','Importation ChinaGo: '||coalesce(v_request.product_title,'Produit'),
   case when v_options<>'' then 'Options choisies: '||v_options else null end,
   'WhatsApp: '||coalesce(v_request.customer_whatsapp,''),v_request.delivery_instructions),
  v_tracking);
 insert into public.order_items(order_id,product_title,quantity,unit_price_xof,line_total_xof,source_url)
 values(v_order_id,coalesce(v_request.product_title,'Produit importé'),v_request.quantity,
  round(v_request.unit_price_xof,0),v_subtotal,v_request.source_url);
 update public.import_requests set order_id=v_order_id,status='converted' where id=v_request.id;
 insert into public.notifications(user_id,title,body,kind)
 values(v_user,'Devis accepté – paiement disponible',
  'Votre commande '||v_number||' est créée. Votre référence ChinaGo est '||v_tracking||'. Vérifiez le montant et procédez au paiement depuis votre espace ChinaGo.','order');
 return v_order_id;
end;
$function$;
revoke all on function public.accept_import_quote(uuid) from public,anon;
grant execute on function public.accept_import_quote(uuid) to authenticated;
