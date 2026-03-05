-- SzakiPiac – EXTRA modulok (Szakember profil + Értékelés + Üzenetek)
-- Futtasd a Supabase SQL Editorban.
-- Megjegyzés: ha nálad más séma / jogosultság van, szólj és igazítjuk.

-- =========================
-- 1) Szakember profil
-- =========================
create table if not exists public.szakember_profiles (
  user_id uuid primary key,
  display_name text,
  city text,
  phone text,
  website text,
  bio text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_szakember_profiles_updated on public.szakember_profiles;
create trigger trg_szakember_profiles_updated
before update on public.szakember_profiles
for each row execute function public.set_updated_at();

alter table public.szakember_profiles enable row level security;

drop policy if exists "profiles_public_read" on public.szakember_profiles;
create policy "profiles_public_read"
on public.szakember_profiles
for select
to anon, authenticated
using (true);

drop policy if exists "profiles_owner_upsert" on public.szakember_profiles;
create policy "profiles_owner_upsert"
on public.szakember_profiles
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "profiles_owner_update" on public.szakember_profiles;
create policy "profiles_owner_update"
on public.szakember_profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- =========================
-- 2) Értékelések (anon is tud írni)
-- =========================
create table if not exists public.szakember_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  visitor_id text not null,
  stars int not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists idx_szakember_ratings_user_id on public.szakember_ratings(user_id);
create index if not exists idx_szakember_ratings_created_at on public.szakember_ratings(created_at desc);

alter table public.szakember_ratings enable row level security;

drop policy if exists "ratings_public_read" on public.szakember_ratings;
create policy "ratings_public_read"
on public.szakember_ratings
for select
to anon, authenticated
using (true);

drop policy if exists "ratings_public_insert" on public.szakember_ratings;
create policy "ratings_public_insert"
on public.szakember_ratings
for insert
to anon, authenticated
with check (
  visitor_id is not null
  and length(visitor_id) > 5
  and user_id is not null
  and stars between 1 and 5
);

-- (opcionális) spam ellen egy egyszerű UNIQUE (egy visitor 1 nap 1 értékelés / user)
-- create unique index if not exists ux_rating_once_per_day
-- on public.szakember_ratings (user_id, visitor_id, (date_trunc('day', created_at)));

-- =========================
-- 3) Üzenetek (anon küldhet, csak a címzett olvashatja)
-- =========================
create table if not exists public.szakember_messages (
  id uuid primary key default gen_random_uuid(),
  to_user_id uuid not null,
  from_visitor_id text not null,
  from_email text,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_szakember_messages_to_user_id on public.szakember_messages(to_user_id);
create index if not exists idx_szakember_messages_created_at on public.szakember_messages(created_at desc);

alter table public.szakember_messages enable row level security;

drop policy if exists "messages_recipient_read" on public.szakember_messages;
create policy "messages_recipient_read"
on public.szakember_messages
for select
to authenticated
using (auth.uid() = to_user_id);

drop policy if exists "messages_public_insert" on public.szakember_messages;
create policy "messages_public_insert"
on public.szakember_messages
for insert
to anon, authenticated
with check (
  to_user_id is not null
  and from_visitor_id is not null
  and length(from_visitor_id) > 5
  and message is not null
  and length(message) > 1
);

-- (opcionális) címzett tudja olvasottnak jelölni
drop policy if exists "messages_recipient_update" on public.szakember_messages;
create policy "messages_recipient_update"
on public.szakember_messages
for update
to authenticated
using (auth.uid() = to_user_id)
with check (auth.uid() = to_user_id);
