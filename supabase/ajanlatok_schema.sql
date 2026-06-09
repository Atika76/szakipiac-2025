-- SzakiPiac AI Árkalkulátor ajánlat mentés + Építési Napló import alap tábla
-- Futtasd a SzakiPiac Supabase SQL Editorában.

create table if not exists public.ajanlatok (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  user_id uuid references auth.users(id) on delete cascade,
  user_email text,

  project_name text,
  client_name text,
  client_email text,
  client_phone text,
  client_city text,
  client_address text,

  currency text default 'HUF',
  subtotal_net numeric default 0,
  overhead_net numeric default 0,
  profit_net numeric default 0,
  discount_net numeric default 0,
  vat_rate numeric default 27,
  vat_amount numeric default 0,
  total_gross numeric default 0,

  payload jsonb not null default '{}'::jsonb
);

create or replace function public.set_ajanlatok_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_ajanlatok_updated_at on public.ajanlatok;
create trigger trg_ajanlatok_updated_at
before update on public.ajanlatok
for each row
execute function public.set_ajanlatok_updated_at();

alter table public.ajanlatok enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.ajanlatok to authenticated;

drop policy if exists "ajanlatok_select_own_or_admin" on public.ajanlatok;
create policy "ajanlatok_select_own_or_admin"
on public.ajanlatok
for select
to authenticated
using (
  user_id = auth.uid()
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'atika.76@windowslive.com'
);

drop policy if exists "ajanlatok_insert_own" on public.ajanlatok;
create policy "ajanlatok_insert_own"
on public.ajanlatok
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "ajanlatok_update_own_or_admin" on public.ajanlatok;
create policy "ajanlatok_update_own_or_admin"
on public.ajanlatok
for update
to authenticated
using (
  user_id = auth.uid()
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'atika.76@windowslive.com'
)
with check (
  user_id = auth.uid()
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'atika.76@windowslive.com'
);

drop policy if exists "ajanlatok_delete_own_or_admin" on public.ajanlatok;
create policy "ajanlatok_delete_own_or_admin"
on public.ajanlatok
for delete
to authenticated
using (
  user_id = auth.uid()
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'atika.76@windowslive.com'
);

create index if not exists ajanlatok_user_id_idx on public.ajanlatok(user_id);
create index if not exists ajanlatok_created_at_idx on public.ajanlatok(created_at desc);
create index if not exists ajanlatok_total_gross_idx on public.ajanlatok(total_gross desc);
