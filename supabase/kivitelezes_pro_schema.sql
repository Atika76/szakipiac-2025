-- SzakiPiac KivitelezésPRO – opcionális Supabase tábla
-- Futtatás: Supabase SQL Editorben.
-- A weboldal localStorage mentéssel enélkül is működik.
-- Ez a tábla akkor kell, ha a "Mentés Supabase-ba" gombot is használni akarod.

create table if not exists public.kivitelezes_projektek (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  user_id uuid,
  user_email text,

  project_name text not null default 'Névtelen kivitelezési projekt',
  client_name text,
  location text,
  total_gross numeric default 0,
  status text not null default 'draft',

  payload jsonb not null default '{}'::jsonb
);

alter table public.kivitelezes_projektek enable row level security;

-- Data API / supabase-js jogosultságok
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.kivitelezes_projektek to authenticated;

drop policy if exists "kivitelezes_select_own_or_admin" on public.kivitelezes_projektek;
create policy "kivitelezes_select_own_or_admin"
on public.kivitelezes_projektek
for select
to authenticated
using (
  user_id = auth.uid()
  or auth.jwt() ->> 'email' = 'atika.76@windowslive.com'
);

drop policy if exists "kivitelezes_insert_own" on public.kivitelezes_projektek;
create policy "kivitelezes_insert_own"
on public.kivitelezes_projektek
for insert
to authenticated
with check (
  user_id = auth.uid()
);

drop policy if exists "kivitelezes_update_own_or_admin" on public.kivitelezes_projektek;
create policy "kivitelezes_update_own_or_admin"
on public.kivitelezes_projektek
for update
to authenticated
using (
  user_id = auth.uid()
  or auth.jwt() ->> 'email' = 'atika.76@windowslive.com'
)
with check (
  user_id = auth.uid()
  or auth.jwt() ->> 'email' = 'atika.76@windowslive.com'
);

drop policy if exists "kivitelezes_delete_own_or_admin" on public.kivitelezes_projektek;
create policy "kivitelezes_delete_own_or_admin"
on public.kivitelezes_projektek
for delete
to authenticated
using (
  user_id = auth.uid()
  or auth.jwt() ->> 'email' = 'atika.76@windowslive.com'
);

create or replace function public.set_kivitelezes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_kivitelezes_updated_at on public.kivitelezes_projektek;
create trigger trg_kivitelezes_updated_at
before update on public.kivitelezes_projektek
for each row
execute function public.set_kivitelezes_updated_at();

create index if not exists kivitelezes_projektek_user_id_idx on public.kivitelezes_projektek(user_id);
create index if not exists kivitelezes_projektek_created_at_idx on public.kivitelezes_projektek(created_at desc);
