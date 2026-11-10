begin;

drop policy if exists "Users can read their own seller applications" on public.seller_applications;
create policy "Applicants and admins can read seller applications" on public.seller_applications
 for select to authenticated
 using (user_id = (select auth.uid()) or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy "Admins can update seller applications" on public.seller_applications
 for update to authenticated
 using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
 with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
grant update (status) on public.seller_applications to authenticated;

drop policy if exists "Users can read their own supplier applications" on public.supplier_applications;
create policy "Applicants and admins can read supplier applications" on public.supplier_applications
 for select to authenticated
 using (user_id = (select auth.uid()) or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy "Admins can update supplier applications" on public.supplier_applications
 for update to authenticated
 using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
 with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
grant update (status) on public.supplier_applications to authenticated;

create or replace function public.review_seller_application(p_application_id uuid, p_status text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
 v_user_id uuid;
 v_account_type text;
begin
 if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then
  raise exception 'Accès administrateur requis';
 end if;
 if p_status not in ('approved','rejected') then raise exception 'Statut invalide'; end if;
 select user_id, account_type into v_user_id, v_account_type
 from public.seller_applications where id = p_application_id for update;
 if v_user_id is null then raise exception 'Candidature introuvable'; end if;
 update public.seller_applications set status = p_status where id = p_application_id;
 if p_status = 'approved' then
  update public.profiles set role = case when v_account_type = 'dropshipper' then 'dropshipper' else 'seller' end
  where id = v_user_id;
 end if;
 insert into public.notifications(user_id,title,body,kind)
 values (v_user_id,
  case when p_status = 'approved' then 'Candidature acceptée' else 'Candidature non retenue' end,
  case when p_status = 'approved' then 'Votre espace vendeur/dropshipping ChinaGo est maintenant activé.' else 'Votre candidature ChinaGo n’a pas été retenue pour le moment.' end,
  'partner');
end;
$$;
revoke all on function public.review_seller_application(uuid,text) from public, anon;
grant execute on function public.review_seller_application(uuid,text) to authenticated;

create or replace function public.review_supplier_application(p_application_id uuid, p_status text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_user_id uuid;
begin
 if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then
  raise exception 'Accès administrateur requis';
 end if;
 if p_status not in ('approved','rejected') then raise exception 'Statut invalide'; end if;
 select user_id into v_user_id from public.supplier_applications where id = p_application_id for update;
 if v_user_id is null then raise exception 'Candidature introuvable'; end if;
 update public.supplier_applications set status = p_status where id = p_application_id;
 if p_status = 'approved' then update public.profiles set role = 'supplier' where id = v_user_id; end if;
 insert into public.notifications(user_id,title,body,kind)
 values (v_user_id,
  case when p_status = 'approved' then 'Candidature fournisseur acceptée' else 'Candidature fournisseur non retenue' end,
  case when p_status = 'approved' then 'Votre profil fournisseur ChinaGo est activé. Notre équipe vous contactera pour la suite.' else 'Votre candidature fournisseur ChinaGo n’a pas été retenue pour le moment.' end,
  'partner');
end;
$$;
revoke all on function public.review_supplier_application(uuid,text) from public, anon;
grant execute on function public.review_supplier_application(uuid,text) to authenticated;

commit;