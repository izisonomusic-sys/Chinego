alter table public.cargo_requests alter column cargo_partner_id drop not null;
grant update (cargo_partner_id) on public.cargo_requests to authenticated;