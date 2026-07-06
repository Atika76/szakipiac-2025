-- SzakiPiac Munkafigyelő - megrendelői munkafeladás engedélyezése
-- Ezt egyszer futtasd le Supabase SQL Editorban, hogy a bejelentkezett felhasználók
-- tudjanak saját megrendelői munkát feladni a Munkafigyelőbe.

begin;

-- A meglévő admin policy marad, ez csak a saját megrendelői rekordokra ad jogot.
create policy if not exists "munkafigyelo_megrendelo_sajat_insert"
on public.munkafigyelo_hirdetesek
for insert to authenticated
with check (
  auth.uid() = owner_id
  and forras_tipus = 'megrendelo'
  and allapot = 'aktiv'
);

create policy if not exists "munkafigyelo_megrendelo_sajat_update"
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

create policy if not exists "munkafigyelo_megrendelo_sajat_delete"
on public.munkafigyelo_hirdetesek
for delete to authenticated
using (
  auth.uid() = owner_id
  and forras_tipus = 'megrendelo'
);

commit;
