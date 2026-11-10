-- ChinaGo isolated administration: customer support inbox and payment ledger.
create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null default 'Assistance ChinaGo',
  status text not null default 'open' check (status in ('open','waiting','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_role text not null check (sender_role in ('customer','admin')),
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);
create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_xof numeric(14,2) not null check (amount_xof >= 0),
  payment_method text,
  provider text,
  provider_reference text,
  status text not null default 'pending' check (status in ('pending','confirmed','failed','refunded')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists support_conversations_user_updated_idx on public.support_conversations(user_id, updated_at desc);
create index if not exists support_messages_conversation_created_idx on public.support_messages(conversation_id, created_at);
create index if not exists payment_transactions_order_idx on public.payment_transactions(order_id);
create index if not exists payment_transactions_user_created_idx on public.payment_transactions(user_id, created_at desc);
alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;
alter table public.payment_transactions enable row level security;
drop policy if exists "Customers and admins read support conversations" on public.support_conversations;
create policy "Customers and admins read support conversations" on public.support_conversations for select to authenticated using (
  user_id = (select auth.uid()) or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
);
drop policy if exists "Customers create own support conversations" on public.support_conversations;
create policy "Customers create own support conversations" on public.support_conversations for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "Customers and admins update support conversations" on public.support_conversations;
create policy "Customers and admins update support conversations" on public.support_conversations for update to authenticated using (
  user_id = (select auth.uid()) or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
) with check (
  user_id = (select auth.uid()) or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
);
drop policy if exists "Conversation members read support messages" on public.support_messages;
create policy "Conversation members read support messages" on public.support_messages for select to authenticated using (
  exists (select 1 from public.support_conversations c where c.id = conversation_id and (
    c.user_id = (select auth.uid()) or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  ))
);
drop policy if exists "Conversation members send support messages" on public.support_messages;
create policy "Conversation members send support messages" on public.support_messages for insert to authenticated with check (
  sender_id = (select auth.uid()) and exists (
    select 1 from public.support_conversations c where c.id = conversation_id and (
      (c.user_id = (select auth.uid()) and sender_role = 'customer') or
      (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin') and sender_role = 'admin')
    )
  )
);
drop policy if exists "Customers read own payment transactions" on public.payment_transactions;
create policy "Customers read own payment transactions" on public.payment_transactions for select to authenticated using (
  user_id = (select auth.uid()) or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
);
drop policy if exists "Admins manage payment transactions" on public.payment_transactions;
create policy "Admins manage payment transactions" on public.payment_transactions for all to authenticated using (
  exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
) with check (
  exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
);
grant select, insert, update on public.support_conversations to authenticated;
grant select, insert on public.support_messages to authenticated;
grant select, insert, update on public.payment_transactions to authenticated;
