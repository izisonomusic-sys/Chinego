-- Tighten payment ledger RLS and index new foreign keys.
drop policy if exists "Customers read own payment transactions" on public.payment_transactions;
drop policy if exists "Admins manage payment transactions" on public.payment_transactions;
drop policy if exists "Customers and admins read payment transactions" on public.payment_transactions;
create policy "Customers and admins read payment transactions" on public.payment_transactions
for select to authenticated using (
  user_id = (select auth.uid()) or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
);
create policy "Admins insert payment transactions" on public.payment_transactions
for insert to authenticated with check (
  exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
);
create policy "Admins update payment transactions" on public.payment_transactions
for update to authenticated using (
  exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
) with check (
  exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
);
create policy "Admins delete payment transactions" on public.payment_transactions
for delete to authenticated using (
  exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
);
create index if not exists payment_transactions_created_by_idx on public.payment_transactions(created_by);
create index if not exists supplier_messages_created_by_idx on public.supplier_messages(created_by);
create index if not exists supplier_payments_created_by_idx on public.supplier_payments(created_by);
create index if not exists supplier_payments_import_request_id_idx on public.supplier_payments(import_request_id);
create index if not exists support_messages_sender_id_idx on public.support_messages(sender_id);
