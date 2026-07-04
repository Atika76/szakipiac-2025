-- SzakiPiac Munkafigyelő - tiszta leadgyűjtő SQL
-- Ezt az egy SQL-t kell futtatni Supabase SQL Editorban.
-- A Munkafigyelőben nincs hirdetésfeladás; külső munkák, nyilvános források és közbeszerzések jelennek meg.

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
  allapot text not null default 'aktiv',
  forras_tipus text not null default 'nyilvanos_forras',
  forras_url text,
  lejar_at timestamptz not null default (now() + interval '90 days'),
  push_kuldve_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.munkafigyelo_hirdetesek add column if not exists owner_id uuid references auth.users(id) on delete set null;
alter table public.munkafigyelo_hirdetesek add column if not exists iranyitoszam text;
alter table public.munkafigyelo_hirdetesek add column if not exists surgosseg text not null default 'normal';
alter table public.munkafigyelo_hirdetesek add column if not exists koltseg_min bigint;
alter table public.munkafigyelo_hirdetesek add column if not exists koltseg_max bigint;
alter table public.munkafigyelo_hirdetesek add column if not exists kezdes_datum date;
alter table public.munkafigyelo_hirdetesek add column if not exists allapot text not null default 'aktiv';
alter table public.munkafigyelo_hirdetesek add column if not exists forras_tipus text not null default 'nyilvanos_forras';
alter table public.munkafigyelo_hirdetesek add column if not exists forras_url text;
alter table public.munkafigyelo_hirdetesek add column if not exists lejar_at timestamptz not null default (now() + interval '90 days');
alter table public.munkafigyelo_hirdetesek add column if not exists push_kuldve_at timestamptz;
alter table public.munkafigyelo_hirdetesek add column if not exists created_at timestamptz not null default now();
alter table public.munkafigyelo_hirdetesek add column if not exists updated_at timestamptz not null default now();

alter table public.munkafigyelo_hirdetesek drop constraint if exists munkafigyelo_surgosseg_check;
alter table public.munkafigyelo_hirdetesek add constraint munkafigyelo_surgosseg_check check (surgosseg in ('normal', 'hamarosan', 'surgos')) not valid;

alter table public.munkafigyelo_hirdetesek drop constraint if exists munkafigyelo_allapot_check;
alter table public.munkafigyelo_hirdetesek add constraint munkafigyelo_allapot_check check (allapot in ('aktiv', 'lezart', 'betoltve', 'letiltva')) not valid;

alter table public.munkafigyelo_hirdetesek drop constraint if exists munkafigyelo_forras_tipus_check;
alter table public.munkafigyelo_hirdetesek add constraint munkafigyelo_forras_tipus_check check (forras_tipus in ('megrendelo', 'nyilvanos_forras', 'kozbeszerzes')) not valid;

alter table public.munkafigyelo_hirdetesek drop constraint if exists munkafigyelo_koltseg_sorrend;
alter table public.munkafigyelo_hirdetesek add constraint munkafigyelo_koltseg_sorrend check (koltseg_min is null or koltseg_max is null or koltseg_max >= koltseg_min) not valid;

create index if not exists idx_munkafigyelo_aktiv_friss on public.munkafigyelo_hirdetesek (allapot, lejar_at, created_at desc);
create index if not exists idx_munkafigyelo_forras_tipus on public.munkafigyelo_hirdetesek (forras_tipus, created_at desc);
create index if not exists idx_munkafigyelo_szures on public.munkafigyelo_hirdetesek (szakma, megye, surgosseg);

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
grant select, insert, update, delete on public.munkafigyelo_hirdetesek to authenticated;

drop policy if exists "munkafigyelo_admin_all" on public.munkafigyelo_hirdetesek;
create policy "munkafigyelo_admin_all" on public.munkafigyelo_hirdetesek
for all to authenticated
using (public.is_szakipiac_admin())
with check (public.is_szakipiac_admin());

drop policy if exists "munkafigyelo_owner_contact_select" on public.munkafigyelo_hirdetesek;
create policy "munkafigyelo_owner_contact_select" on public.munkafigyelo_hirdetesek
for select to authenticated using (owner_id = auth.uid() or public.is_szakipiac_admin());

create or replace view public.munkafigyelo_nyilvanos
with (security_invoker = false)
as
select
  id, cim, leiras, szakma, megye, telepules, iranyitoszam,
  surgosseg, koltseg_min, koltseg_max, kezdes_datum,
  forras_tipus, forras_url, lejar_at, created_at, updated_at,
  (owner_id is not null) as kapcsolat_elerheto
from public.munkafigyelo_hirdetesek
where allapot = 'aktiv'
  and lejar_at > now()
  and (forras_tipus = 'megrendelo' or coalesce(trim(forras_url), '') <> '');

revoke all on public.munkafigyelo_nyilvanos from public;
grant select on public.munkafigyelo_nyilvanos to anon, authenticated;

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

alter table public.munkafigyelo_push_feliratkozasok enable row level security;
grant select, insert, update, delete on public.munkafigyelo_push_feliratkozasok to authenticated;

drop policy if exists "munkafigyelo_push_sajat_select" on public.munkafigyelo_push_feliratkozasok;
create policy "munkafigyelo_push_sajat_select" on public.munkafigyelo_push_feliratkozasok
for select to authenticated using (user_id = auth.uid() or public.is_szakipiac_admin());

drop policy if exists "munkafigyelo_push_sajat_insert" on public.munkafigyelo_push_feliratkozasok;
create policy "munkafigyelo_push_sajat_insert" on public.munkafigyelo_push_feliratkozasok
for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "munkafigyelo_push_sajat_update" on public.munkafigyelo_push_feliratkozasok;
create policy "munkafigyelo_push_sajat_update" on public.munkafigyelo_push_feliratkozasok
for update to authenticated using (user_id = auth.uid() or public.is_szakipiac_admin())
with check (user_id = auth.uid() or public.is_szakipiac_admin());

drop policy if exists "munkafigyelo_push_sajat_delete" on public.munkafigyelo_push_feliratkozasok;
create policy "munkafigyelo_push_sajat_delete" on public.munkafigyelo_push_feliratkozasok
for delete to authenticated using (user_id = auth.uid() or public.is_szakipiac_admin());

create table if not exists public.munkafigyelo_ertesites_esemenyek (
  id uuid primary key default gen_random_uuid(),
  hirdetes_id uuid not null references public.munkafigyelo_hirdetesek(id) on delete cascade,
  tipus text not null default 'uj_munka',
  feldolgozva boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.munkafigyelo_ertesites_esemenyek enable row level security;
grant select, update, delete on public.munkafigyelo_ertesites_esemenyek to authenticated;

drop policy if exists "munkafigyelo_ertesites_admin" on public.munkafigyelo_ertesites_esemenyek;
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

-- Régi rossz tesztadatok törlése: külső forrás link nélkül.
delete from public.munkafigyelo_hirdetesek
where forras_tipus <> 'megrendelo'
  and coalesce(trim(forras_url), '') = '';

-- Duplikált forráslinkek takarítása.
delete from public.munkafigyelo_hirdetesek a
using public.munkafigyelo_hirdetesek b
where a.forras_url is not null
  and a.forras_url = b.forras_url
  and a.ctid < b.ctid;

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

Becsült érték/keret: Közbeszerzés', 'Generálkivitelező', 'Országos', 'Budapest', 'normal', 'kozbeszerzes', 'https://ted.europa.eu/hu/notice/432263-2026/html', '2026-06-25T00:00:00.000Z'::timestamptz)
on conflict (forras_url) where forras_url is not null do update set
  cim = excluded.cim,
  leiras = excluded.leiras,
  szakma = excluded.szakma,
  megye = excluded.megye,
  telepules = excluded.telepules,
  surgosseg = excluded.surgosseg,
  forras_tipus = excluded.forras_tipus,
  updated_at = now();
