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


-- Ha a tábla korábban már részben létrejött, ezek pótolják a hiányzó oszlopokat.
alter table public.munkafigyelo_hirdetesek add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.munkafigyelo_hirdetesek add column if not exists iranyitoszam text;
alter table public.munkafigyelo_hirdetesek add column if not exists surgosseg text not null default 'normal';
alter table public.munkafigyelo_hirdetesek add column if not exists koltseg_min bigint;
alter table public.munkafigyelo_hirdetesek add column if not exists koltseg_max bigint;
alter table public.munkafigyelo_hirdetesek add column if not exists kezdes_datum date;
alter table public.munkafigyelo_hirdetesek add column if not exists allapot text not null default 'aktiv';
alter table public.munkafigyelo_hirdetesek add column if not exists forras_tipus text not null default 'megrendelo';
alter table public.munkafigyelo_hirdetesek add column if not exists forras_url text;
alter table public.munkafigyelo_hirdetesek add column if not exists lejar_at timestamptz not null default (now() + interval '30 days');
alter table public.munkafigyelo_hirdetesek add column if not exists push_kuldve_at timestamptz;
alter table public.munkafigyelo_hirdetesek add column if not exists created_at timestamptz not null default now();
alter table public.munkafigyelo_hirdetesek add column if not exists updated_at timestamptz not null default now();

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




-- Megrendelői munka feladása biztos RPC-n keresztül. Ez megkerüli a böngészős RLS-buktatókat,
-- de továbbra is a bejelentkezett felhasználót teszi tulajdonossá.
create or replace function public.munkafigyelo_munka_feladasa(
  p_cim text,
  p_leiras text,
  p_szakma text,
  p_megye text,
  p_telepules text,
  p_iranyitoszam text default null,
  p_surgosseg text default 'normal',
  p_koltseg_min bigint default null,
  p_koltseg_max bigint default null,
  p_kezdes_datum date default null
)
returns public.munkafigyelo_hirdetesek
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.munkafigyelo_hirdetesek%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Munka feladásához be kell jelentkezni.';
  end if;
  if char_length(trim(coalesce(p_cim, ''))) < 8 then
    raise exception 'Adj meg egy legalább 8 karakteres munkacímet.';
  end if;
  if char_length(trim(coalesce(p_leiras, ''))) < 30 then
    raise exception 'A részletes leírás legyen legalább 30 karakter.';
  end if;
  if p_koltseg_min is not null and p_koltseg_min < 0 then
    raise exception 'A minimum keret nem lehet negatív.';
  end if;
  if p_koltseg_max is not null and p_koltseg_max < 0 then
    raise exception 'A maximum keret nem lehet negatív.';
  end if;
  if p_koltseg_min is not null and p_koltseg_max is not null and p_koltseg_max < p_koltseg_min then
    raise exception 'A maximális keret nem lehet kisebb a minimálisnál.';
  end if;

  insert into public.munkafigyelo_hirdetesek (
    owner_id, cim, leiras, szakma, megye, telepules, iranyitoszam,
    surgosseg, koltseg_min, koltseg_max, kezdes_datum,
    allapot, forras_tipus, forras_url, lejar_at
  ) values (
    auth.uid(), trim(p_cim), trim(p_leiras), p_szakma, p_megye, trim(p_telepules), nullif(trim(coalesce(p_iranyitoszam, '')), ''),
    coalesce(nullif(p_surgosseg, ''), 'normal'), p_koltseg_min, p_koltseg_max, p_kezdes_datum,
    'aktiv', 'megrendelo', null, now() + interval '30 days'
  ) returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.munkafigyelo_munka_feladasa(text, text, text, text, text, text, text, bigint, bigint, date) from public;
grant execute on function public.munkafigyelo_munka_feladasa(text, text, text, text, text, text, text, bigint, bigint, date) to authenticated;

-- Hibás, link nélküli külső minták törlése, mert ezekre nem lehet válaszolni és nem lehet megnyitni.
delete from public.munkafigyelo_hirdetesek
where forras_tipus <> 'megrendelo'
  and coalesce(trim(forras_url), '') = '';

-- Kezdő közbeszerzési/nyilvános munkák import a SzakiLead ZIP-ből.
-- Többször is futtatható, a forrás URL alapján nem dupláz.
create unique index if not exists idx_munkafigyelo_unique_forras_url
  on public.munkafigyelo_hirdetesek (forras_url)
  where forras_url is not null;

insert into public.munkafigyelo_hirdetesek
  (cim, leiras, szakma, megye, telepules, surgosseg, forras_tipus, forras_url, created_at)
values
('Magyarország – Közúti híd építése – K-híd felújítása (ép. ber. kivitelezés)', 'Kiíró: Budapest Közút Zártkörűen Működő Részvénytársaság

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Budapest', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/456926-2026/html', '2026-07-03T00:00:00.000Z'::timestamptz),
('Magyarország – Épületszerelési munka – Csodapók Óvoda - Napsugár Bölcsőde felújítása', 'Kiíró: Kőbányai Vagyonkezelő Zártkörűen Működő Részvénytársaság

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Budapest', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/458201-2026/html', '2026-07-03T00:00:00.000Z'::timestamptz),
('Magyarország – Pályaépítés – Aljcsere folyópályában és kitérőben', 'Kiíró: MÁV Pályaműködtetési Zártkörűen Működő Részvénytársaság

Becsült érték/keret: 4 473 237 000 HUF', 'Generálkivitelező', 'Országos', 'Budapest', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/459274-2026/html', '2026-07-03T00:00:00.000Z'::timestamptz),
('Magyarország – Iskolaépületek kivitelezése – Bővítés a Nógrádmegyeri Mikszáth K. Ált. Iskolában', 'Kiíró: Balassagyarmati Tankerületi Központ

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Balassagyarmat', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/459725-2026/html', '2026-07-03T00:00:00.000Z'::timestamptz),
('Magyarország – Alállomás építése – „Alállomások tervezése és kivitelezése"', 'Kiíró: MÁV Pályaműködtetési Zártkörűen Működő Részvénytársaság

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Budapest', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/459885-2026/html', '2026-07-03T00:00:00.000Z'::timestamptz),
('Magyarország – Építési munkák – M1 Hegyeshalom határátkelő akadálymentesítése I.', 'Kiíró: Építési és Közlekedési Minisztérium

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Budapest', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/460594-2026/html', '2026-07-03T00:00:00.000Z'::timestamptz),
('Magyarország – Közút építése – Kenyérgyári út - Textilgyári út korszerűsítése', 'Kiíró: Szeged Megyei Jogú Város Önkormányzata

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Szeged', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/453831-2026/html', '2026-07-02T00:00:00.000Z'::timestamptz),
('Magyarország – Építési munkák – Bánki Donát Műszaki Tech. és Koll. belső felújítás', 'Kiíró: Nyíregyházi Szakképzési Centrum

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Nyíregyháza', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/455319-2026/html', '2026-07-02T00:00:00.000Z'::timestamptz),
('Magyarország – Villamosperon építési munkái – 50-es villamosvonal peronfelújítás, II-es ütem', 'Kiíró: BKK Budapesti Közlekedési Központ Zártkörűen Működő Részvénytársaság

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Budapest', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/455988-2026/html', '2026-07-02T00:00:00.000Z'::timestamptz),
('Magyarország – Építési munkák – Infrastruktúra fejlesztés Széchenyi Műszaki Tech.', 'Kiíró: Székesfehérvári Szakképzési Centrum

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Székesfehérvár', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/449947-2026/html', '2026-07-01T00:00:00.000Z'::timestamptz),
('Magyarország – Felsővezeték építése – Szombathely-Kőszeg vasútvonal villamosítása', 'Kiíró: Győr-Sopron-Ebenfurti Vasút Zártkörűen Működő Részvénytársaság

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Sopron', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/450441-2026/html', '2026-07-01T00:00:00.000Z'::timestamptz),
('Magyarország – Építési munkák – Gyömrő, Fekete István Ált. Iskola újjáépítése', 'Kiíró: Építési és Közlekedési Minisztérium

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Budapest', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/452089-2026/html', '2026-07-01T00:00:00.000Z'::timestamptz),
('Magyarország – Hirdetési és marketingszolgáltatások – Komplex kommunikációs feladatok DKFP részére (243)', 'Kiíró: Digitális Kormányzati Fejlesztés és Projektmenedzsment Korlátolt Felelősségű Társaság

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Budapest', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/452435-2026/html', '2026-07-01T00:00:00.000Z'::timestamptz),
('Magyarország – Vasútépítés – Pályavasúti karbantartási,felújítási tevékenységek', 'Kiíró: MÁV Pályaműködtetési Zártkörűen Működő Részvénytársaság

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Budapest', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/452724-2026/html', '2026-07-01T00:00:00.000Z'::timestamptz),
('Magyarország – Vízelvezető rendszer építése – RESILIMET projekt: csapadékvíz-kezelés fejlesztése', 'Kiíró: Budapest Airport Budapest Liszt Ferenc Nemzetközi Repülőtér Üzemeltető Zártkörűen Működő Részvénytársaság

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Budapest', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/445875-2026/html', '2026-06-30T00:00:00.000Z'::timestamptz),
('Magyarország – Pályaépítés – Aljcsere folyópályában és kitérőben', 'Kiíró: MÁV Pályaműködtetési Zártkörűen Működő Részvénytársaság

Becsült érték/keret: 4 473 237 000 HUF', 'Generálkivitelező', 'Országos', 'Budapest', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/445938-2026/html', '2026-06-30T00:00:00.000Z'::timestamptz),
('Magyarország – Építési munkák – KM-Burkolatfennt. és kapcs. forgalomt. munkák 2025', 'Kiíró: Újpesti Városgondnokság Szolgáltató Kft.

Becsült érték/keret: 1 500 000 000 HUF', 'Burkoló', 'Országos', 'Budapest', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/446225-2026/html', '2026-06-30T00:00:00.000Z'::timestamptz),
('Magyarország – Közút építése – Tölgyes utca felújítása', 'Kiíró: Nyíregyháza Megyei Jogú Város Önkormányzata

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Nyíregyháza', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/446472-2026/html', '2026-06-30T00:00:00.000Z'::timestamptz),
('Magyarország – Építési munkák – Szeged,Széchenyi tér 11. műemlék épület felújítás', 'Kiíró: Szeged Megyei Jogú Város Önkormányzata

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Szeged', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/446596-2026/html', '2026-06-30T00:00:00.000Z'::timestamptz),
('Magyarország – Építési munkák – Perkupa 22 KV-os kapcsolóállomás rekonstrukció___', 'Kiíró: MVM Émász Áramhálózati Kft.

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Miskolc', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/448349-2026/html', '2026-06-30T00:00:00.000Z'::timestamptz),
('Magyarország – Építési munkák – Péczeli József Ált Iskola és AMI infrastr. fejl.', 'Kiíró: Kazincbarcikai Tankerületi Központ

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Kazincbarcika', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/442044-2026/html', '2026-06-29T00:00:00.000Z'::timestamptz),
('Magyarország – Műemlékek megőrzésével kapcsolatos szolgáltatások – Rajka, középkori falfestmény restaurálása', 'Kiíró: Rajkai Római Katolikus Plébánia

Becsült érték/keret: 25 550 000 HUF', 'Generálkivitelező', 'Országos', 'Rajka', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/443658-2026/html', '2026-06-29T00:00:00.000Z'::timestamptz),
('Magyarország – Légbefúvó rendszer – Szennyvíztelepi forgódugattyús fúvók cseréje- Pápa', 'Kiíró: Pápai Víz- és Csatornamű Zrt.

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Pápa', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/445724-2026/html', '2026-06-29T00:00:00.000Z'::timestamptz),
('Magyarország – Tűzoltó, mentő- és biztonsági felszerelések – Tűzszimulációs eszközök beszerzése', 'Kiíró: Belügyminisztérium Országos Katasztrófavédelmi Főigazgatóság

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Budapest', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/439163-2026/html', '2026-06-26T00:00:00.000Z'::timestamptz),
('Magyarország – Építési munkák – Aszfaltozás,burkolati jel festése MÁV PM hálózatán', 'Kiíró: MÁV Pályaműködtetési Zártkörűen Működő Részvénytársaság

Becsült érték/keret: Közbeszerzés', 'Burkoló', 'Országos', 'Budapest', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/439500-2026/html', '2026-06-26T00:00:00.000Z'::timestamptz),
('Magyarország – Vízi létesítmények építése – Szeged Algyői főcsatorna fejlesztés IV. ütem', 'Kiíró: Országos Vízügyi Főigazgatóság

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Budapest', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/439746-2026/html', '2026-06-26T00:00:00.000Z'::timestamptz),
('Magyarország – Útburkolat építése – R100 - Földi oldali infrastruktúra fejlesztés', 'Kiíró: Budapest Airport Budapest Liszt Ferenc Nemzetközi Repülőtér Üzemeltető Zártkörűen Működő Részvénytársaság

Becsült érték/keret: Közbeszerzés', 'Burkoló', 'Országos', 'Budapest', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/439942-2026/html', '2026-06-26T00:00:00.000Z'::timestamptz),
('Magyarország – Villamos hálózati szerelés – Földeléstelepítés KÖF szabadlégvezetékes hálózaton', 'Kiíró: MVM Démász Áramhálózati Kft.

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Szeged', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/440482-2026/html', '2026-06-26T00:00:00.000Z'::timestamptz),
('Magyarország – Képalkotó berendezés orvosi, fogászati és állatorvosi használatra – DEK-1585 Röntgen és mammográf készülé', 'Kiíró: Debreceni Egyetem

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Debrecen', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/431761-2026/html', '2026-06-25T00:00:00.000Z'::timestamptz),
('Magyarország – Építési munkák – Nyírbátor Várost elkerülő utak kivitelezése', 'Kiíró: Építési és Közlekedési Minisztérium

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Budapest', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/432263-2026/html', '2026-06-25T00:00:00.000Z'::timestamptz),
('Magyarország – Építési munkák – Keretmegállapodás kivitelezési munkák 3.', 'Kiíró: Semmelweis Egyetem

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Budapest', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/432969-2026/html', '2026-06-25T00:00:00.000Z'::timestamptz),
('Magyarország – Iskolaépületek kivitelezése – Meglévő tanműhely energetikai korszerűsítése', 'Kiíró: Szolnoki Szakképzési Centrum

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Szolnok', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/433493-2026/html', '2026-06-25T00:00:00.000Z'::timestamptz),
('Magyarország – Teljes vagy részleges magas- és mélyépítési munka – ÉMO14 szennyvíztiszt. és csat. hál. fejl. feladata', 'Kiíró: Közlekedési és Beruházási Minisztérium

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Budapest', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/433612-2026/html', '2026-06-25T00:00:00.000Z'::timestamptz),
('Magyarország – Kutatási és kísérleti létesítmények kiviteletése – HSM Gyógyszerkutatási Centrum kialakítása I. ütem', 'Kiíró: Semmelweis Egyetem

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Budapest', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/435383-2026/html', '2026-06-25T00:00:00.000Z'::timestamptz),
('Magyarország – Építési munkák – DEK-1388 DE Főépület homlokzat felújítás', 'Kiíró: Debreceni Egyetem

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Debrecen', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/435906-2026/html', '2026-06-25T00:00:00.000Z'::timestamptz),
('Magyarország – Útburkolat építése – 471. sz. főút (1+000-2+850 km) fejlesztése', 'Kiíró: Építési és Közlekedési Minisztérium

Becsült érték/keret: Közbeszerzés', 'Burkoló', 'Országos', 'Budapest', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/436050-2026/html', '2026-06-25T00:00:00.000Z'::timestamptz),
('Magyarország – Gázvezetékek építése – Gázelosztó vezeték rekonstrukciós munkák', 'Kiíró: MVM Főgáz Földgázhálózati Kft.

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Budapest', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/436577-2026/html', '2026-06-25T00:00:00.000Z'::timestamptz),
('Magyarország – Centrifuga – Centrifuga és kihordórendszerének cseréje', 'Kiíró: Fővárosi Vízművek Zártkörűen Működő Részvénytársaság

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Budapest', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/437486-2026/html', '2026-06-25T00:00:00.000Z'::timestamptz),
('Magyarország – Erősáramú vezeték építése – Hálózatfejlesztés-Hálózati csatlakozás megvalósítá', 'Kiíró: MVM Démász Áramhálózati Kft.

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Szeged', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/438132-2026/html', '2026-06-25T00:00:00.000Z'::timestamptz),
('Magyarország – Építési munkák – Szolgáltatóház kialakítása', 'Kiíró: Karcag Városi Önkormányzat

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Karcag', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/438566-2026/html', '2026-06-25T00:00:00.000Z'::timestamptz),
('Magyarország – Kardio-angiográfiás készülékek – DEK-1621 DSA készülék besz. bérleti konstrukcióban', 'Kiíró: Debreceni Egyetem

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Debrecen', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/430547-2026/html', '2026-06-24T00:00:00.000Z'::timestamptz),
('Magyarország – Villamosperon építési munkái – 56-56A villamosvonal peronok akadálymentesítése', 'Kiíró: BKK Budapesti Közlekedési Központ Zártkörűen Működő Részvénytársaság

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Budapest', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/430881-2026/html', '2026-06-24T00:00:00.000Z'::timestamptz),
('Magyarország – Alállomás építése – DUVI 132/11 kV-os alállomás, kábelvonal létesítése', 'Kiíró: ELMŰ Hálózati Kft.

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Budapest', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/431298-2026/html', '2026-06-24T00:00:00.000Z'::timestamptz),
('Magyarország – Villamos hálózati szerelés – Üzemzavarelhárítási és megelőzési munkák Émász', 'Kiíró: MVM Émász Áramhálózati Kft.

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Miskolc', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/431706-2026/html', '2026-06-24T00:00:00.000Z'::timestamptz),
('Magyarország – Építési munkák – SZTE Szentesi MC geoterm.hőell.kialakítása II.ütem', 'Kiíró: Szegedi Tudományegyetem

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Szeged', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/425515-2026/html', '2026-06-22T00:00:00.000Z'::timestamptz),
('Magyarország – Alállomás építése – Pécel 132/22 kV alállomás létesítése', 'Kiíró: ELMŰ Hálózati Kft.

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Budapest', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/426976-2026/html', '2026-06-22T00:00:00.000Z'::timestamptz),
('Magyarország – Víz- és szennyvízvezetékek építése – Veszprém, Cholnoky J. u vízvezeték rekonstrukció', 'Kiíró: Kiskunsági Víziközmű-Szolgáltató Korlátolt Felelősségű Társaság

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Kiskunhalas', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/427312-2026/html', '2026-06-22T00:00:00.000Z'::timestamptz),
('Magyarország – Közvilágítás-karbantartási szolgáltatások – Közvilágítás korszerűsítés Sátoraljaújhelyen', 'Kiíró: Sátoraljaújhely Város Önkormányzata

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Sátoraljaújhely', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/427503-2026/html', '2026-06-22T00:00:00.000Z'::timestamptz),
('Magyarország – Magasépítési munka – Infrastrukturális fejlesztés Tarnamérai Ált. Isk.', 'Kiíró: Egri Tankerületi Központ

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Eger', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/427674-2026/html', '2026-06-22T00:00:00.000Z'::timestamptz)
on conflict do nothing;
