-- SzakiPiac Munkafigyelő - megrendelői munkafeladás RPC
-- Stabil mentés nem-admin felhasználóknak RLS mellett is.

begin;

create or replace function public.munkafigyelo_megrendelo_feladasa(
  p_cim text,
  p_leiras text,
  p_szakma text,
  p_megye text,
  p_telepules text,
  p_iranyitoszam text default '',
  p_surgosseg text default 'normal',
  p_koltseg_min bigint default null,
  p_koltseg_max bigint default null,
  p_kezdes_datum date default null,
  p_lejar_at timestamptz default null,
  p_munka_tipus text default null,
  p_ingatlan_tipus text default null,
  p_kapcsolat_mod text default null,
  p_kapcsolat_telefon text default null,
  p_kapcsolat_email text default null,
  p_kep_url_tomb text[] default array[]::text[]
)
returns table(id uuid, cim text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_cim text := trim(coalesce(p_cim, ''));
  v_leiras text := trim(coalesce(p_leiras, ''));
  v_szakma text := trim(coalesce(p_szakma, ''));
  v_megye text := trim(coalesce(p_megye, ''));
  v_telepules text := trim(coalesce(p_telepules, ''));
  v_surgosseg text := coalesce(nullif(trim(coalesce(p_surgosseg, '')), ''), 'normal');
begin
  if auth.uid() is null then
    raise exception 'Bejelentkezés szükséges.';
  end if;

  if v_cim = '' or v_leiras = '' or v_szakma = '' or v_megye = '' or v_telepules = '' then
    raise exception 'Cím, leírás, kategória, megye és település kötelező.';
  end if;

  if v_surgosseg not in ('normal', 'hamarosan', 'surgos') then
    v_surgosseg := 'normal';
  end if;

  if p_koltseg_min is not null and p_koltseg_max is not null and p_koltseg_min > p_koltseg_max then
    raise exception 'A minimum keret nem lehet nagyobb, mint a maximum keret.';
  end if;

  insert into public.munkafigyelo_hirdetesek (
    owner_id,
    cim,
    leiras,
    szakma,
    megye,
    telepules,
    iranyitoszam,
    surgosseg,
    koltseg_min,
    koltseg_max,
    kezdes_datum,
    munka_tipus,
    ingatlan_tipus,
    kapcsolat_mod,
    kapcsolat_telefon,
    kapcsolat_email,
    kep_url_tomb,
    allapot,
    forras_tipus,
    forras_url,
    lejar_at
  )
  values (
    auth.uid(),
    v_cim,
    v_leiras,
    v_szakma,
    v_megye,
    v_telepules,
    trim(coalesce(p_iranyitoszam, '')),
    v_surgosseg,
    p_koltseg_min,
    p_koltseg_max,
    p_kezdes_datum,
    nullif(trim(coalesce(p_munka_tipus, '')), ''),
    nullif(trim(coalesce(p_ingatlan_tipus, '')), ''),
    nullif(trim(coalesce(p_kapcsolat_mod, '')), ''),
    nullif(trim(coalesce(p_kapcsolat_telefon, '')), ''),
    nullif(trim(coalesce(p_kapcsolat_email, '')), ''),
    coalesce(p_kep_url_tomb, array[]::text[]),
    'aktiv',
    'megrendelo',
    null,
    coalesce(p_lejar_at, now() + interval '30 days')
  )
  returning munkafigyelo_hirdetesek.id into v_id;

  return query select v_id, v_cim;
end;
$$;

revoke all on function public.munkafigyelo_megrendelo_feladasa(
  text, text, text, text, text, text, text, bigint, bigint, date, timestamptz, text, text, text, text, text, text[]
) from public;

grant execute on function public.munkafigyelo_megrendelo_feladasa(
  text, text, text, text, text, text, text, bigint, bigint, date, timestamptz, text, text, text, text, text, text[]
) to authenticated;

commit;
