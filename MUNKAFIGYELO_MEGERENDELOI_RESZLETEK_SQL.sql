-- SzakiPiac Munkafigyelő - megrendelői munka részletek bővítése
-- Megye, munka típusa, ingatlan típusa, kapcsolat módja és munkafotók tárolása.

begin;

alter table public.munkafigyelo_hirdetesek
  add column if not exists munka_tipus text,
  add column if not exists ingatlan_tipus text,
  add column if not exists kapcsolat_mod text,
  add column if not exists kapcsolat_telefon text,
  add column if not exists kapcsolat_email text,
  add column if not exists kep_url_tomb text[] not null default array[]::text[];

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

commit;
