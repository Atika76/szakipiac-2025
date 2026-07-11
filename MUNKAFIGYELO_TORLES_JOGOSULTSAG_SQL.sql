-- SzakiPiac Munkafigyelő - saját és admin törlési jogosultság előkészítése
-- Ezt egyszer futtasd le Supabase SQL Editorban.
-- A nyilvános nézet kap egy torolheto mezőt, ami jelzi a frontendnek,
-- hogy az aktuális bejelentkezett felhasználó lezárhatja/törölheti-e a rekordot.

begin;

-- Biztosítsuk, hogy saját megrendelői rekordot lehessen módosítani/lezárni.
drop policy if exists "munkafigyelo_megrendelo_sajat_update" on public.munkafigyelo_hirdetesek;
drop policy if exists "munkafigyelo_megrendelo_sajat_delete" on public.munkafigyelo_hirdetesek;

create policy "munkafigyelo_megrendelo_sajat_update"
on public.munkafigyelo_hirdetesek
for update to authenticated
using (
  auth.uid() = owner_id
  and forras_tipus = 'megrendelo'
)
with check (
  auth.uid() = owner_id
  and forras_tipus = 'megrendelo'
);

create policy "munkafigyelo_megrendelo_sajat_delete"
on public.munkafigyelo_hirdetesek
for delete to authenticated
using (
  auth.uid() = owner_id
  and forras_tipus = 'megrendelo'
);

-- A nézetben megjelenik, hogy az aktuális user törölheti/lezárhatja-e.
drop view if exists public.munkafigyelo_nyilvanos;
create view public.munkafigyelo_nyilvanos
with (security_invoker = false)
as
select
  id, cim, leiras, szakma, megye, telepules, iranyitoszam,
  surgosseg, koltseg_min, koltseg_max, kezdes_datum,
  munka_tipus, ingatlan_tipus, kapcsolat_mod, kapcsolat_telefon, kapcsolat_email, kep_url_tomb,
  forras_tipus, forras_url, lejar_at, created_at, updated_at,
  (owner_id is not null and forras_tipus = 'megrendelo') as kapcsolat_elerheto,
  (
    public.is_szakipiac_admin()
    or (auth.uid() is not null and owner_id = auth.uid() and forras_tipus = 'megrendelo')
  ) as torolheto
from public.munkafigyelo_hirdetesek
where allapot = 'aktiv'
  and lejar_at > now()
  and (forras_tipus = 'megrendelo' or coalesce(trim(forras_url), '') <> '');

revoke all on public.munkafigyelo_nyilvanos from public;
grant select on public.munkafigyelo_nyilvanos to anon, authenticated;

commit;
