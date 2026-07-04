-- SzakiPiac Munkafigyelő
-- Megrendelői munkák, védett kapcsolatfelvétel, jelentések és web push beállítások.

create extension if not exists pgcrypto;

create or replace function public.is_szakipiac_admin()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'atika.76@windowslive.com';
$$;

create table if not exists public.munkafigyelo_hirdetesek (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  cim text not null check (char_length(cim) between 8 and 120),
  leiras text not null check (char_length(leiras) between 30 and 4000),
  szakma text not null check (char_length(szakma) between 2 and 80),
  megye text not null check (char_length(megye) between 2 and 80),
  telepules text not null check (char_length(telepules) between 2 and 100),
  iranyitoszam text,
  surgosseg text not null default 'normal' check (surgosseg in ('normal', 'hamarosan', 'surgos')),
  koltseg_min bigint check (koltseg_min is null or koltseg_min >= 0),
  koltseg_max bigint check (koltseg_max is null or koltseg_max >= 0),
  kezdes_datum date,
  allapot text not null default 'aktiv' check (allapot in ('aktiv', 'lezart', 'betoltve', 'letiltva')),
  forras_tipus text not null default 'megrendelo' check (forras_tipus in ('megrendelo', 'nyilvanos_forras', 'kozbeszerzes')),
  forras_url text,
  lejar_at timestamptz not null default (now() + interval '30 days'),
  push_kuldve_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint munkafigyelo_koltseg_sorrend check (
    koltseg_min is null or koltseg_max is null or koltseg_max >= koltseg_min
  ),
  constraint munkafigyelo_forras_url check (
    forras_tipus = 'megrendelo' or forras_url is not null
  )
);

create index if not exists idx_munkafigyelo_aktiv_friss
  on public.munkafigyelo_hirdetesek (allapot, lejar_at, created_at desc);
create index if not exists idx_munkafigyelo_owner
  on public.munkafigyelo_hirdetesek (owner_id, created_at desc);
create index if not exists idx_munkafigyelo_szures
  on public.munkafigyelo_hirdetesek (szakma, megye, surgosseg);

create or replace function public.munkafigyelo_set_updated_at()
returns trigger
language plpgsql
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

alter table public.munkafigyelo_hirdetesek enable row level security;
revoke all on public.munkafigyelo_hirdetesek from anon, authenticated;
grant select, insert, update, delete on public.munkafigyelo_hirdetesek to authenticated;

drop policy if exists "munkafigyelo_owner_admin_select" on public.munkafigyelo_hirdetesek;
create policy "munkafigyelo_owner_admin_select"
on public.munkafigyelo_hirdetesek for select to authenticated
using (owner_id = auth.uid() or public.is_szakipiac_admin());

drop policy if exists "munkafigyelo_owner_insert" on public.munkafigyelo_hirdetesek;
create policy "munkafigyelo_owner_insert"
on public.munkafigyelo_hirdetesek for insert to authenticated
with check (
  owner_id = auth.uid()
  and forras_tipus = 'megrendelo'
  and allapot = 'aktiv'
  and lejar_at <= now() + interval '31 days'
);

drop policy if exists "munkafigyelo_admin_insert" on public.munkafigyelo_hirdetesek;
create policy "munkafigyelo_admin_insert"
on public.munkafigyelo_hirdetesek for insert to authenticated
with check (public.is_szakipiac_admin());

drop policy if exists "munkafigyelo_owner_admin_update" on public.munkafigyelo_hirdetesek;
create policy "munkafigyelo_owner_admin_update"
on public.munkafigyelo_hirdetesek for update to authenticated
using (owner_id = auth.uid() or public.is_szakipiac_admin())
with check (
  public.is_szakipiac_admin()
  or (
    owner_id = auth.uid()
    and forras_tipus = 'megrendelo'
    and allapot in ('aktiv', 'lezart', 'betoltve')
  )
);

drop policy if exists "munkafigyelo_owner_admin_delete" on public.munkafigyelo_hirdetesek;
create policy "munkafigyelo_owner_admin_delete"
on public.munkafigyelo_hirdetesek for delete to authenticated
using (owner_id = auth.uid() or public.is_szakipiac_admin());

-- A nyilvános nézet szándékosan nem tartalmaz owner_id-t vagy kapcsolati adatot.
create or replace view public.munkafigyelo_nyilvanos
with (security_invoker = false)
as
select
  id, cim, leiras, szakma, megye, telepules, iranyitoszam,
  surgosseg, koltseg_min, koltseg_max, kezdes_datum,
  forras_tipus, forras_url, lejar_at, created_at, updated_at,
  (owner_id is not null) as kapcsolat_elerheto
from public.munkafigyelo_hirdetesek
where allapot = 'aktiv' and lejar_at > now();

revoke all on public.munkafigyelo_nyilvanos from public;
grant select on public.munkafigyelo_nyilvanos to anon, authenticated;

create table if not exists public.munkafigyelo_jelentesek (
  id uuid primary key default gen_random_uuid(),
  hirdetes_id uuid not null references public.munkafigyelo_hirdetesek(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  ok text not null check (ok in ('spam', 'teves', 'lejart', 'jogserto', 'egyeb')),
  megjegyzes text check (megjegyzes is null or char_length(megjegyzes) <= 1000),
  allapot text not null default 'uj' check (allapot in ('uj', 'kezelve', 'elutasitva')),
  created_at timestamptz not null default now(),
  unique (hirdetes_id, reporter_id)
);

alter table public.munkafigyelo_jelentesek enable row level security;
grant select, insert, update, delete on public.munkafigyelo_jelentesek to authenticated;

drop policy if exists "munkafigyelo_jelentes_sajat_vagy_admin_select" on public.munkafigyelo_jelentesek;
create policy "munkafigyelo_jelentes_sajat_vagy_admin_select"
on public.munkafigyelo_jelentesek for select to authenticated
using (reporter_id = auth.uid() or public.is_szakipiac_admin());

drop policy if exists "munkafigyelo_jelentes_insert" on public.munkafigyelo_jelentesek;
create policy "munkafigyelo_jelentes_insert"
on public.munkafigyelo_jelentesek for insert to authenticated
with check (reporter_id = auth.uid() and allapot = 'uj');

drop policy if exists "munkafigyelo_jelentes_admin_update" on public.munkafigyelo_jelentesek;
create policy "munkafigyelo_jelentes_admin_update"
on public.munkafigyelo_jelentesek for update to authenticated
using (public.is_szakipiac_admin()) with check (public.is_szakipiac_admin());

drop policy if exists "munkafigyelo_jelentes_admin_delete" on public.munkafigyelo_jelentesek;
create policy "munkafigyelo_jelentes_admin_delete"
on public.munkafigyelo_jelentesek for delete to authenticated
using (public.is_szakipiac_admin());

create table if not exists public.munkafigyelo_push_feliratkozasok (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  szakmak text[] not null default '{}',
  megyek text[] not null default '{}',
  surgossegek text[] not null default '{normal,hamarosan,surgos}',
  aktiv boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_munkafigyelo_push_user
  on public.munkafigyelo_push_feliratkozasok (user_id);

drop trigger if exists trg_munkafigyelo_push_updated_at on public.munkafigyelo_push_feliratkozasok;
create trigger trg_munkafigyelo_push_updated_at
before update on public.munkafigyelo_push_feliratkozasok
for each row execute function public.munkafigyelo_set_updated_at();

alter table public.munkafigyelo_push_feliratkozasok enable row level security;
revoke all on public.munkafigyelo_push_feliratkozasok from anon, authenticated;
grant select, insert, update, delete on public.munkafigyelo_push_feliratkozasok to authenticated;

drop policy if exists "munkafigyelo_push_sajat_vagy_admin_select" on public.munkafigyelo_push_feliratkozasok;
create policy "munkafigyelo_push_sajat_vagy_admin_select"
on public.munkafigyelo_push_feliratkozasok for select to authenticated
using (user_id = auth.uid() or public.is_szakipiac_admin());

drop policy if exists "munkafigyelo_push_sajat_insert" on public.munkafigyelo_push_feliratkozasok;
create policy "munkafigyelo_push_sajat_insert"
on public.munkafigyelo_push_feliratkozasok for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "munkafigyelo_push_sajat_update" on public.munkafigyelo_push_feliratkozasok;
create policy "munkafigyelo_push_sajat_update"
on public.munkafigyelo_push_feliratkozasok for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "munkafigyelo_push_sajat_delete" on public.munkafigyelo_push_feliratkozasok;
create policy "munkafigyelo_push_sajat_delete"
on public.munkafigyelo_push_feliratkozasok for delete to authenticated
using (user_id = auth.uid() or public.is_szakipiac_admin());

-- Kapcsolatfelvétel úgy, hogy a hirdető azonosítója ne kerüljön a böngészőbe.
create or replace function public.munkafigyelo_kapcsolat_kuldese(
  p_hirdetes_id uuid,
  p_uzenet text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_message_id uuid;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'A kapcsolatfelvételhez be kell jelentkezni.';
  end if;
  if char_length(trim(coalesce(p_uzenet, ''))) < 10 or char_length(p_uzenet) > 2000 then
    raise exception 'Az üzenet hossza 10 és 2000 karakter között lehet.';
  end if;

  select owner_id into v_owner
  from public.munkafigyelo_hirdetesek
  where id = p_hirdetes_id and allapot = 'aktiv' and lejar_at > now();

  if v_owner is null then
    raise exception 'Ehhez a hirdetéshez nincs belső kapcsolatfelvétel.';
  end if;
  if v_owner = auth.uid() then
    raise exception 'A saját hirdetésedre nem küldhetsz üzenetet.';
  end if;

  v_email := auth.jwt() ->> 'email';
  insert into public.szakember_messages (to_user_id, from_visitor_id, from_email, message)
  values (
    v_owner,
    auth.uid()::text,
    v_email,
    '[Munkafigyelő – ' || p_hirdetes_id::text || '] ' || trim(p_uzenet)
  )
  returning id into v_message_id;

  return v_message_id;
end;
$$;

revoke all on function public.munkafigyelo_kapcsolat_kuldese(uuid, text) from public;
grant execute on function public.munkafigyelo_kapcsolat_kuldese(uuid, text) to authenticated;

-- A meglévő üzenetrendszerben a feladó is láthassa és törölhesse a saját üzeneteit.
drop policy if exists "messages_participant_read" on public.szakember_messages;
create policy "messages_participant_read"
on public.szakember_messages for select to authenticated
using (auth.uid() = to_user_id or auth.uid()::text = from_visitor_id);

drop policy if exists "messages_participant_delete" on public.szakember_messages;
create policy "messages_participant_delete"
on public.szakember_messages for delete to authenticated
using (auth.uid() = to_user_id or auth.uid()::text = from_visitor_id);

grant delete on public.szakember_messages to authenticated;

