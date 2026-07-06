-- SzakiPiac Munkafigyelő - lezáró RPC
-- Ezt egyszer futtasd Supabase SQL Editorban.

create or replace function public.munkafigyelo_lezaras(p_hirdetes_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Bejelentkezés szükséges.';
  end if;

  update public.munkafigyelo_hirdetesek
  set allapot = 'lezart', updated_at = now()
  where id = p_hirdetes_id
    and allapot = 'aktiv'
    and (
      public.is_szakipiac_admin()
      or (owner_id = auth.uid() and forras_tipus = 'megrendelo')
    );

  if not found then
    raise exception 'Nincs jogosultságod ehhez a művelethez.';
  end if;

  return true;
end;
$$;

revoke all on function public.munkafigyelo_lezaras(uuid) from public;
grant execute on function public.munkafigyelo_lezaras(uuid) to authenticated;
