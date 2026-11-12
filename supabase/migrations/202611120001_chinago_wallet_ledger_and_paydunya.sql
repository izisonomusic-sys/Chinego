alter table public.payment_transactions
  add column if not exists provider_invoice_token text,
  add column if not exists checkout_url text,
  add column if not exists provider_payload jsonb,
  add column if not exists confirmed_at timestamptz;

create unique index if not exists payment_transactions_provider_invoice_token_uidx
  on public.payment_transactions(provider, provider_invoice_token)
  where provider_invoice_token is not null;

alter table public.wallet_accounts
  add column if not exists available_balance numeric(14,2) not null default 0,
  add column if not exists pending_balance numeric(14,2) not null default 0,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  wallet_account_id uuid not null references public.wallet_accounts(id),
  user_id uuid not null references auth.users(id),
  entry_type text not null check (entry_type in ('sale_pending','sale_available','commission','payout_hold','payout_release','refund','adjustment')),
  direction text not null check (direction in ('credit','debit')),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'XOF' check (currency = 'XOF'),
  reference_type text,
  reference_id uuid,
  description text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.payout_requests
  add column if not exists currency text not null default 'XOF',
  add column if not exists destination_type text,
  add column if not exists destination_name text,
  add column if not exists destination_account text,
  add column if not exists destination_provider text;

create index if not exists wallet_accounts_owner_idx on public.wallet_accounts(owner_user_id);
create index if not exists wallet_ledger_user_created_idx on public.wallet_ledger(user_id, created_at desc);
create index if not exists payout_requests_user_created_idx on public.payout_requests(user_id, requested_at desc);
create index if not exists payout_requests_status_idx on public.payout_requests(status, requested_at);

alter table public.wallet_accounts enable row level security;
alter table public.wallet_ledger enable row level security;
alter table public.payout_requests enable row level security;

drop policy if exists "wallet owner reads own account" on public.wallet_accounts;
create policy "wallet owner reads own account" on public.wallet_accounts
for select to authenticated using (owner_user_id = auth.uid());

drop policy if exists "wallet owner reads own ledger" on public.wallet_ledger;
create policy "wallet owner reads own ledger" on public.wallet_ledger
for select to authenticated using (user_id = auth.uid());

drop policy if exists "wallet owner reads own payout requests" on public.payout_requests;
create policy "wallet owner reads own payout requests" on public.payout_requests
for select to authenticated using (user_id = auth.uid());

drop policy if exists "wallet owner creates own payout requests" on public.payout_requests;
create policy "wallet owner creates own payout requests" on public.payout_requests
for insert to authenticated with check (
  user_id = auth.uid()
  and status = 'requested'
  and exists (select 1 from public.wallet_accounts w where w.id = wallet_account_id and w.owner_user_id = auth.uid() and w.status = 'active')
);

grant select on public.wallet_accounts, public.wallet_ledger, public.payout_requests to authenticated;
grant insert on public.payout_requests to authenticated;
