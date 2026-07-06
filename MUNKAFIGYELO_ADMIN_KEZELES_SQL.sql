-- SzakiPiac Munkafigyelő - admin kezelés
-- Futtasd egyszer Supabase SQL Editorban.
-- Admin lista, visszaállítás és végleges törlés.

create or replace function public.munkafigyelo_admin_lista()
returns table (
  id uuid,
  cim text,
  szakma text,
  telepules text,
  forras_tipus text,
  allapot text,
  owner_id uuid,
  created_at timestamptz,
  lejar_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    h.id, h.cim, h.szakma, h.telepules, h.forras_tipus, h.allapot,
    h.owner_id, h.created_at, h.lejar_at
  from public.munkafigyelo_hirdetesek h
  where public.is_szakipiac_admin()
  order by h.created_at desc
  limit 300;
$$;

create or replace function public.munkafigyelo_visszaallitas(p_hirdetes_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_szakipiac_admin() then
    raise exception 'Nincs admin jogosultság.';
  end if;

  update public.munkafigyelo_hirdetesek
  set allapot = 'aktiv', updated_at = now(),
      lejar_at = greatest(coalesce(lejar_at, now() + interval '30 days'), now() + interval '30 days')
  where id = p_hirdetes_id;

  if not found then
    raise exception 'Nem található rekord.';
  end if;

  return true;
end;
$$;

create or replace function public.munkafigyelo_vegleges_torles(p_hirdetes_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_szakipiac_admin() then
    raise exception 'Nincs admin jogosultság.';
  end if;

  delete from public.munkafigyelo_hirdetesek
  where id = p_hirdetes_id;

  if not found then
    raise exception 'Nem található rekord.';
  end if;

  return true;
end;
$$;

revoke all on function public.munkafigyelo_admin_lista() from public;
revoke all on function public.munkafigyelo_visszaallitas(uuid) from public;
revoke all on function public.munkafigyelo_vegleges_torles(uuid) from public;

grant execute on function public.munkafigyelo_admin_lista() to authenticated;
grant execute on function public.munkafigyelo_visszaallitas(uuid) to authenticated;
grant execute on function public.munkafigyelo_vegleges_torles(uuid) to authenticated;
