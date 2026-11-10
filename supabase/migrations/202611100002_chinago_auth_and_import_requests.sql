-- ChinaGo auth bootstrap and product import request intake
create schema if not exists private;

create or replace function private.handle_new_chinago_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'customer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_chinago_user() from public, anon, authenticated;

drop trigger if exists on_chinago_user_created on auth.users;
create trigger on_chinago_user_created
after insert on auth.users
for each row execute function private.handle_new_chinago_user();

drop policy if exists "Users can create their own profile" on public.profiles;
revoke insert on public.profiles from anon, authenticated;

create table if not exists public.import_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_url text not null,
  source_platform text not null
    check (source_platform in ('alibaba','amazon','ebay','other')),
  status text not null default 'submitted'
    check (status in ('submitted','needs_details','quoted','accepted','rejected','converted')),
  customer_notes text,
  created_at timestamptz not null default now()
);

create index if not exists import_requests_user_created_idx
  on public.import_requests(user_id, created_at desc);

alter table public.import_requests enable row level security;

create policy "Users can submit their own import requests"
  on public.import_requests for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can read their own import requests"
  on public.import_requests for select to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert on public.import_requests to authenticated;
