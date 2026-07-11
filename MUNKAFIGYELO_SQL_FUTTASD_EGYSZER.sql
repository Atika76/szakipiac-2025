-- SzakiPiac Munkafigyelő - egyszer futtatandó, végleges adatbázis-beállítás
-- A Munkafigyelő csak külső munkákat, belső megrendelői rekordokat és közbeszerzéseket listáz.

begin;

create extension if not exists pgcrypto;

create or replace function public.is_szakipiac_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'atika.76@windowslive.com'
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

revoke all on function public.is_szakipiac_admin() from public;
grant execute on function public.is_szakipiac_admin() to authenticated;

create table if not exists public.munkafigyelo_hirdetesek (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  cim text not null,
  leiras text not null,
  szakma text not null default 'Egyéb szakember',
  megye text not null default 'Országos',
  telepules text not null default '',
  iranyitoszam text,
  surgosseg text not null default 'normal',
  koltseg_min bigint,
  koltseg_max bigint,
  kezdes_datum date,
  munka_tipus text,
  ingatlan_tipus text,
  kapcsolat_mod text,
  kapcsolat_telefon text,
  kapcsolat_email text,
  kep_url_tomb text[] not null default array[]::text[],
  allapot text not null default 'aktiv',
  forras_tipus text not null default 'nyilvanos_forras',
  forras_url text,
  lejar_at timestamptz not null default (now() + interval '90 days'),
  push_kuldve_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.munkafigyelo_hirdetesek add column if not exists owner_id uuid references auth.users(id) on delete set null;
alter table public.munkafigyelo_hirdetesek add column if not exists cim text;
alter table public.munkafigyelo_hirdetesek add column if not exists leiras text;
alter table public.munkafigyelo_hirdetesek add column if not exists szakma text not null default 'Egyéb szakember';
alter table public.munkafigyelo_hirdetesek add column if not exists megye text not null default 'Országos';
alter table public.munkafigyelo_hirdetesek add column if not exists telepules text not null default '';
alter table public.munkafigyelo_hirdetesek add column if not exists iranyitoszam text;
alter table public.munkafigyelo_hirdetesek add column if not exists surgosseg text not null default 'normal';
alter table public.munkafigyelo_hirdetesek add column if not exists koltseg_min bigint;
alter table public.munkafigyelo_hirdetesek add column if not exists koltseg_max bigint;
alter table public.munkafigyelo_hirdetesek add column if not exists kezdes_datum date;
alter table public.munkafigyelo_hirdetesek add column if not exists munka_tipus text;
alter table public.munkafigyelo_hirdetesek add column if not exists ingatlan_tipus text;
alter table public.munkafigyelo_hirdetesek add column if not exists kapcsolat_mod text;
alter table public.munkafigyelo_hirdetesek add column if not exists kapcsolat_telefon text;
alter table public.munkafigyelo_hirdetesek add column if not exists kapcsolat_email text;
alter table public.munkafigyelo_hirdetesek add column if not exists kep_url_tomb text[] not null default array[]::text[];
alter table public.munkafigyelo_hirdetesek add column if not exists allapot text not null default 'aktiv';
alter table public.munkafigyelo_hirdetesek add column if not exists forras_tipus text not null default 'nyilvanos_forras';
alter table public.munkafigyelo_hirdetesek add column if not exists forras_url text;
alter table public.munkafigyelo_hirdetesek add column if not exists lejar_at timestamptz not null default (now() + interval '90 days');
alter table public.munkafigyelo_hirdetesek add column if not exists push_kuldve_at timestamptz;
alter table public.munkafigyelo_hirdetesek add column if not exists created_at timestamptz not null default now();
alter table public.munkafigyelo_hirdetesek add column if not exists updated_at timestamptz not null default now();

alter table public.munkafigyelo_hirdetesek drop constraint if exists munkafigyelo_cim_len;
alter table public.munkafigyelo_hirdetesek drop constraint if exists munkafigyelo_leiras_len;
alter table public.munkafigyelo_hirdetesek drop constraint if exists munkafigyelo_surgosseg_check;
alter table public.munkafigyelo_hirdetesek add constraint munkafigyelo_surgosseg_check
  check (surgosseg in ('normal', 'hamarosan', 'surgos')) not valid;
alter table public.munkafigyelo_hirdetesek drop constraint if exists munkafigyelo_allapot_check;
alter table public.munkafigyelo_hirdetesek add constraint munkafigyelo_allapot_check
  check (allapot in ('aktiv', 'lezart', 'betoltve', 'letiltva')) not valid;
alter table public.munkafigyelo_hirdetesek drop constraint if exists munkafigyelo_forras_tipus_check;
alter table public.munkafigyelo_hirdetesek add constraint munkafigyelo_forras_tipus_check
  check (forras_tipus in ('megrendelo', 'nyilvanos_forras', 'kozbeszerzes')) not valid;
alter table public.munkafigyelo_hirdetesek drop constraint if exists munkafigyelo_koltseg_sorrend;
alter table public.munkafigyelo_hirdetesek add constraint munkafigyelo_koltseg_sorrend
  check (koltseg_min is null or koltseg_max is null or koltseg_max >= koltseg_min) not valid;

create or replace function public.munkafigyelo_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_munkafigyelo_updated_at on public.munkafigyelo_hirdetesek;
create trigger trg_munkafigyelo_updated_at
before update on public.munkafigyelo_hirdetesek
for each row execute function public.munkafigyelo_set_updated_at();

-- Link nélküli külső rekordok nem jelenhetnek meg.
delete from public.munkafigyelo_hirdetesek
where forras_tipus <> 'megrendelo'
  and coalesce(trim(forras_url), '') = '';

-- Azonos forráslinkből a legfrissebb rekord maradjon meg.
delete from public.munkafigyelo_hirdetesek older
using public.munkafigyelo_hirdetesek newer
where older.forras_url is not null
  and older.forras_url = newer.forras_url
  and (older.created_at, older.id) < (newer.created_at, newer.id);

create index if not exists idx_munkafigyelo_aktiv_friss
  on public.munkafigyelo_hirdetesek (allapot, lejar_at, created_at desc);
create index if not exists idx_munkafigyelo_forras_tipus
  on public.munkafigyelo_hirdetesek (forras_tipus, created_at desc);
create index if not exists idx_munkafigyelo_szures
  on public.munkafigyelo_hirdetesek (szakma, megye, surgosseg);
create unique index if not exists idx_munkafigyelo_unique_forras_url
  on public.munkafigyelo_hirdetesek (forras_url)
  where forras_url is not null;

alter table public.munkafigyelo_hirdetesek enable row level security;
revoke all on public.munkafigyelo_hirdetesek from anon, authenticated;
grant select, insert, update, delete on public.munkafigyelo_hirdetesek to authenticated;

-- Minden régi, nyilvános munkafeladást engedő policy eltávolítása.
do $$
declare policy_row record;
begin
  for policy_row in select policyname from pg_policies where schemaname = 'public' and tablename = 'munkafigyelo_hirdetesek'
  loop
    execute format('drop policy if exists %I on public.munkafigyelo_hirdetesek', policy_row.policyname);
  end loop;
end $$;

create policy "munkafigyelo_csak_admin"
on public.munkafigyelo_hirdetesek
for all to authenticated
using (public.is_szakipiac_admin())
with check (public.is_szakipiac_admin());

drop view if exists public.munkafigyelo_nyilvanos;
create view public.munkafigyelo_nyilvanos
with (security_invoker = false)
as
select
  id, cim, leiras, szakma, megye, telepules, iranyitoszam,
  surgosseg, koltseg_min, koltseg_max, kezdes_datum,
  munka_tipus, ingatlan_tipus, kapcsolat_mod, kapcsolat_telefon, kapcsolat_email, kep_url_tomb,
  forras_tipus, forras_url, lejar_at, created_at, updated_at,
  (owner_id is not null and forras_tipus = 'megrendelo') as kapcsolat_elerheto
from public.munkafigyelo_hirdetesek
where allapot = 'aktiv'
  and lejar_at > now()
  and (forras_tipus = 'megrendelo' or coalesce(trim(forras_url), '') <> '');

revoke all on public.munkafigyelo_nyilvanos from public;
grant select on public.munkafigyelo_nyilvanos to anon, authenticated;

-- A régi nyilvános munkafeladó RPC megszüntetése.
drop function if exists public.munkafigyelo_munka_feladasa(text, text, text, text, text, text, text, bigint, bigint, date);

create or replace function public.munkafigyelo_kapcsolat_kuldese(p_hirdetes_id uuid, p_uzenet text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_message_id uuid;
begin
  if auth.uid() is null then raise exception 'A kapcsolatfelvételhez be kell jelentkezni.'; end if;
  if char_length(trim(coalesce(p_uzenet, ''))) < 10 or char_length(p_uzenet) > 2000 then
    raise exception 'Az üzenet hossza 10 és 2000 karakter között lehet.';
  end if;
  select owner_id into v_owner
  from public.munkafigyelo_hirdetesek
  where id = p_hirdetes_id
    and forras_tipus = 'megrendelo'
    and allapot = 'aktiv'
    and lejar_at > now();
  if v_owner is null then raise exception 'Ehhez a rekordhoz nincs belső kapcsolatfelvétel.'; end if;
  if v_owner = auth.uid() then raise exception 'Saját rekordra nem küldhetsz üzenetet.'; end if;
  insert into public.szakember_messages (to_user_id, from_visitor_id, from_email, message)
  values (v_owner, auth.uid()::text, auth.jwt() ->> 'email', '[Munkafigyelő – ' || p_hirdetes_id::text || '] ' || trim(p_uzenet))
  returning id into v_message_id;
  return v_message_id;
end;
$$;

revoke all on function public.munkafigyelo_kapcsolat_kuldese(uuid, text) from public;
grant execute on function public.munkafigyelo_kapcsolat_kuldese(uuid, text) to authenticated;

create table if not exists public.munkafigyelo_push_feliratkozasok (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  szakmak text[] not null default array[]::text[],
  megyek text[] not null default array[]::text[],
  surgossegek text[] not null default array[]::text[],
  aktiv boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.munkafigyelo_push_feliratkozasok add column if not exists szakmak text[] not null default array[]::text[];
alter table public.munkafigyelo_push_feliratkozasok add column if not exists megyek text[] not null default array[]::text[];
alter table public.munkafigyelo_push_feliratkozasok add column if not exists surgossegek text[] not null default array[]::text[];
alter table public.munkafigyelo_push_feliratkozasok add column if not exists aktiv boolean not null default true;
alter table public.munkafigyelo_push_feliratkozasok add column if not exists created_at timestamptz not null default now();
alter table public.munkafigyelo_push_feliratkozasok add column if not exists updated_at timestamptz not null default now();
create index if not exists idx_munkafigyelo_push_aktiv on public.munkafigyelo_push_feliratkozasok (aktiv);
create index if not exists idx_munkafigyelo_push_user on public.munkafigyelo_push_feliratkozasok (user_id);

alter table public.munkafigyelo_push_feliratkozasok enable row level security;
revoke all on public.munkafigyelo_push_feliratkozasok from anon, authenticated;
grant select, insert, update, delete on public.munkafigyelo_push_feliratkozasok to authenticated;

do $$
declare policy_row record;
begin
  for policy_row in select policyname from pg_policies where schemaname = 'public' and tablename = 'munkafigyelo_push_feliratkozasok'
  loop
    execute format('drop policy if exists %I on public.munkafigyelo_push_feliratkozasok', policy_row.policyname);
  end loop;
end $$;

create policy "munkafigyelo_push_sajat_select" on public.munkafigyelo_push_feliratkozasok
for select to authenticated using (user_id = auth.uid() or public.is_szakipiac_admin());
create policy "munkafigyelo_push_sajat_insert" on public.munkafigyelo_push_feliratkozasok
for insert to authenticated with check (user_id = auth.uid());
create policy "munkafigyelo_push_sajat_update" on public.munkafigyelo_push_feliratkozasok
for update to authenticated using (user_id = auth.uid() or public.is_szakipiac_admin())
with check (user_id = auth.uid() or public.is_szakipiac_admin());
create policy "munkafigyelo_push_sajat_delete" on public.munkafigyelo_push_feliratkozasok
for delete to authenticated using (user_id = auth.uid() or public.is_szakipiac_admin());

create table if not exists public.munkafigyelo_ertesites_esemenyek (
  id uuid primary key default gen_random_uuid(),
  hirdetes_id uuid not null references public.munkafigyelo_hirdetesek(id) on delete cascade,
  tipus text not null default 'uj_munka',
  feldolgozva boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_munkafigyelo_ertesites_feldolgozva
  on public.munkafigyelo_ertesites_esemenyek (feldolgozva, created_at);

alter table public.munkafigyelo_ertesites_esemenyek enable row level security;
revoke all on public.munkafigyelo_ertesites_esemenyek from anon, authenticated;
grant select, update, delete on public.munkafigyelo_ertesites_esemenyek to authenticated;

do $$
declare policy_row record;
begin
  for policy_row in select policyname from pg_policies where schemaname = 'public' and tablename = 'munkafigyelo_ertesites_esemenyek'
  loop
    execute format('drop policy if exists %I on public.munkafigyelo_ertesites_esemenyek', policy_row.policyname);
  end loop;
end $$;

create policy "munkafigyelo_ertesites_admin" on public.munkafigyelo_ertesites_esemenyek
for all to authenticated using (public.is_szakipiac_admin()) with check (public.is_szakipiac_admin());

create or replace function public.munkafigyelo_ertesites_queue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.allapot = 'aktiv' then
    insert into public.munkafigyelo_ertesites_esemenyek (hirdetes_id, tipus)
    values (new.id, case when new.forras_tipus = 'kozbeszerzes' then 'uj_kozbeszerzes' else 'uj_munka' end);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_munkafigyelo_ertesites_queue on public.munkafigyelo_hirdetesek;
create trigger trg_munkafigyelo_ertesites_queue
after insert on public.munkafigyelo_hirdetesek
for each row execute function public.munkafigyelo_ertesites_queue();

commit;
