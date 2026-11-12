-- Product import request: selected options and customer delivery details.
alter table public.import_requests
  add column if not exists selected_options jsonb not null default '{}'::jsonb,
  add column if not exists customer_contact_name text,
  add column if not exists customer_phone text,
  add column if not exists customer_whatsapp text,
  add column if not exists delivery_country text default 'Togo',
  add column if not exists delivery_city text,
  add column if not exists delivery_neighborhood text,
  add column if not exists delivery_street text,
  add column if not exists delivery_instructions text;
