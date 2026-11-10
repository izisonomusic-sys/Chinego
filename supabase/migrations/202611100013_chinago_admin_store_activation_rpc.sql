revoke update (status) on public.stores from authenticated;
create or replace function public.admin_set_store_status(p_store_id uuid, p_status text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
 if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then
  raise exception 'Accès administrateur requis';
 end if;
 if p_status not in ('draft','active','suspended') then raise exception 'Statut invalide'; end if;
 update public.stores set status = p_status, updated_at = now() where id = p_store_id;
 if not found then raise exception 'Boutique introuvable'; end if;
end;
$$;
revoke all on function public.admin_set_store_status(uuid,text) from public, anon;
grant execute on function public.admin_set_store_status(uuid,text) to authenticated;