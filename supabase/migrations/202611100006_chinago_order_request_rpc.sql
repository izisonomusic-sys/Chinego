create or replace function public.request_order(
 p_product_id uuid,
 p_store_product_id uuid,
 p_product_title text,
 p_source_url text,
 p_quantity integer,
 p_unit_price_xof numeric,
 p_contact_name text,
 p_contact_phone text,
 p_contact_email text,
 p_delivery_address text,
 p_delivery_city text,
 p_customer_notes text,
 p_cargo_partner_id uuid
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
 v_user_id uuid := auth.uid();
 v_order_id uuid := gen_random_uuid();
 v_order_number text := 'CG-' || upper(substr(replace(v_order_id::text, '-', ''), 1, 10));
 v_line_total numeric(14,2);
begin
 if v_user_id is null then raise exception 'Authentification requise'; end if;
 if p_quantity is null or p_quantity < 1 or p_quantity > 1000 then raise exception 'Quantité invalide'; end if;
 if nullif(trim(p_product_title), '') is null then raise exception 'Nom du produit requis'; end if;
 if p_unit_price_xof is null or p_unit_price_xof < 0 then raise exception 'Prix invalide'; end if;
 if nullif(trim(p_contact_name), '') is null or nullif(trim(p_contact_phone), '') is null then
   raise exception 'Nom et téléphone requis';
 end if;
 v_line_total := p_unit_price_xof * p_quantity;
 insert into public.orders (
  id, order_number, customer_id, store_id, status, currency,
  subtotal_xof, shipping_xof, total_xof, contact_name, contact_phone,
  contact_email, delivery_address, delivery_city, customer_notes, cargo_partner_id
 ) values (
  v_order_id, v_order_number, v_user_id, null, 'quote_requested', 'XOF',
  v_line_total, 0, v_line_total, trim(p_contact_name), trim(p_contact_phone),
  nullif(trim(coalesce(p_contact_email,'')), ''), trim(coalesce(p_delivery_address,'')),
  trim(coalesce(p_delivery_city,'Lomé')), nullif(trim(coalesce(p_customer_notes,'')), ''),
  p_cargo_partner_id
 );
 insert into public.order_items (
  order_id, product_id, store_product_id, product_title, source_url,
  quantity, unit_price_xof, line_total_xof
 ) values (
  v_order_id, p_product_id, p_store_product_id, trim(p_product_title), nullif(trim(coalesce(p_source_url,'')), ''),
  p_quantity, p_unit_price_xof, v_line_total
 );
 insert into public.notifications(user_id,title,body,kind)
 values (v_user_id,'Demande de commande reçue',
  'Votre demande ' || v_order_number || ' est enregistrée. ChinaGo va vérifier le prix et les frais avant tout paiement.',
  'order');
 return v_order_id;
end;
$$;
revoke all on function public.request_order(uuid,uuid,text,text,integer,numeric,text,text,text,text,text,text,uuid) from public, anon;
grant execute on function public.request_order(uuid,uuid,text,text,integer,numeric,text,text,text,text,text,text,uuid) to authenticated;
grant insert (source_url) on public.order_items to authenticated;