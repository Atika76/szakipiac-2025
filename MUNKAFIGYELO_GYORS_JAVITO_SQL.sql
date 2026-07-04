-- Munkafigyelő gyors javító SQL
-- Ezt futtasd le, ha a munkafeladás gomb nem ment, vagy vannak olyan külső találatok, amelyeket nem lehet megnyitni.

create extension if not exists pgcrypto;

-- Hiányzó oszlopok pótlása régebbi/hibás telepítés esetén
alter table if exists public.munkafigyelo_hirdetesek add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table if exists public.munkafigyelo_hirdetesek add column if not exists iranyitoszam text;
alter table if exists public.munkafigyelo_hirdetesek add column if not exists surgosseg text not null default 'normal';
alter table if exists public.munkafigyelo_hirdetesek add column if not exists koltseg_min bigint;
alter table if exists public.munkafigyelo_hirdetesek add column if not exists koltseg_max bigint;
alter table if exists public.munkafigyelo_hirdetesek add column if not exists kezdes_datum date;
alter table if exists public.munkafigyelo_hirdetesek add column if not exists allapot text not null default 'aktiv';
alter table if exists public.munkafigyelo_hirdetesek add column if not exists forras_tipus text not null default 'megrendelo';
alter table if exists public.munkafigyelo_hirdetesek add column if not exists forras_url text;
alter table if exists public.munkafigyelo_hirdetesek add column if not exists lejar_at timestamptz not null default (now() + interval '30 days');
alter table if exists public.munkafigyelo_hirdetesek add column if not exists push_kuldve_at timestamptz;
alter table if exists public.munkafigyelo_hirdetesek add column if not exists created_at timestamptz not null default now();
alter table if exists public.munkafigyelo_hirdetesek add column if not exists updated_at timestamptz not null default now();

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

-- Link nélküli külső/teszt találatok törlése, mert ezekre nem lehet válaszolni és nincs eredeti hirdetés linkjük.
delete from public.munkafigyelo_hirdetesek
where forras_tipus <> 'megrendelo'
  and coalesce(trim(forras_url), '') = '';
