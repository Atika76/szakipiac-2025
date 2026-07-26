-- SzakiPiac online ajánlatmegtekintés és ügyféldöntés.
-- Ismételten is biztonságosan futtatható.

create extension if not exists pgcrypto with schema extensions;

alter table public.ajanlatok add column if not exists quote_number text;
alter table public.ajanlatok add column if not exists quote_status text not null default 'draft';
alter table public.ajanlatok add column if not exists valid_until timestamptz;
alter table public.ajanlatok add column if not exists sent_at timestamptz;
alter table public.ajanlatok add column if not exists viewed_at timestamptz;
alter table public.ajanlatok add column if not exists accepted_at timestamptz;
alter table public.ajanlatok add column if not exists rejected_at timestamptz;
alter table public.ajanlatok add column if not exists decision_name text;
alter table public.ajanlatok add column if not exists decision_email text;
alter table public.ajanlatok add column if not exists decision_comment text;
alter table public.ajanlatok add column if not exists terms_version text;
alter table public.ajanlatok add column if not exists import_requested_at timestamptz;
alter table public.ajanlatok add column if not exists import_request_id text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ajanlatok_quote_status_check'
      and conrelid = 'public.ajanlatok'::regclass
  ) then
    alter table public.ajanlatok
      add constraint ajanlatok_quote_status_check
      check (quote_status in ('draft','sent','viewed','accepted','rejected','expired'));
  end if;
end $$;

create table if not exists public.ajanlat_megosztasok (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.ajanlatok(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  opened_at timestamptz,
  decided_at timestamptz,
  decision text,
  decision_name text,
  decision_email text,
  decision_comment text,
  terms_accepted boolean not null default false,
  privacy_accepted boolean not null default false,
  terms_version text not null default '2026-07-26-v1',
  revoked_at timestamptz
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ajanlat_megosztasok_decision_check'
      and conrelid = 'public.ajanlat_megosztasok'::regclass
  ) then
    alter table public.ajanlat_megosztasok
      add constraint ajanlat_megosztasok_decision_check
      check (decision is null or decision in ('accepted','rejected'));
  end if;
end $$;

create index if not exists ajanlat_megosztasok_quote_idx
  on public.ajanlat_megosztasok(quote_id, created_at desc);
create index if not exists ajanlat_megosztasok_owner_idx
  on public.ajanlat_megosztasok(owner_user_id, created_at desc);

alter table public.ajanlat_megosztasok enable row level security;

drop policy if exists "ajanlat_megosztasok_owner_select" on public.ajanlat_megosztasok;
create policy "ajanlat_megosztasok_owner_select"
on public.ajanlat_megosztasok
for select
to authenticated
using (
  owner_user_id = auth.uid()
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'atika.76@windowslive.com'
);

revoke all on table public.ajanlat_megosztasok from anon;
grant select on table public.ajanlat_megosztasok to authenticated;

create or replace function public.create_quote_share_v1(
  p_quote_id uuid,
  p_valid_days integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_quote public.ajanlatok%rowtype;
  v_token text;
  v_expires_at timestamptz;
begin
  select * into v_quote
  from public.ajanlatok
  where id = p_quote_id
    and (
      user_id = auth.uid()
      or lower(coalesce(auth.jwt() ->> 'email', '')) = 'atika.76@windowslive.com'
    )
  for update;

  if not found then
    raise exception 'Az ajánlat nem található vagy nincs hozzá jogosultságod.';
  end if;

  if v_quote.quote_status = 'accepted' then
    raise exception 'Az elfogadott ajánlathoz nem készíthető új döntési link.';
  end if;

  update public.ajanlat_megosztasok
  set revoked_at = now()
  where quote_id = p_quote_id
    and revoked_at is null
    and decision is null;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_expires_at := now() + make_interval(days => greatest(1, least(coalesce(p_valid_days, 30), 90)));

  insert into public.ajanlat_megosztasok(
    quote_id, owner_user_id, token_hash, expires_at
  ) values (
    p_quote_id,
    v_quote.user_id,
    encode(digest(v_token, 'sha256'), 'hex'),
    v_expires_at
  );

  update public.ajanlatok
  set quote_status = 'sent',
      quote_number = coalesce(
        nullif(quote_number, ''),
        nullif(payload #>> '{quote_meta,number}', '')
      ),
      sent_at = now(),
      viewed_at = null,
      accepted_at = null,
      rejected_at = null,
      decision_name = null,
      decision_email = null,
      decision_comment = null,
      terms_version = null,
      valid_until = v_expires_at
  where id = p_quote_id;

  return jsonb_build_object(
    'ok', true,
    'token', v_token,
    'expires_at', v_expires_at,
    'status', 'sent'
  );
end;
$$;

create or replace function public.get_public_quote_v1(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_link public.ajanlat_megosztasok%rowtype;
  v_quote public.ajanlatok%rowtype;
  v_status text;
begin
  select * into v_link
  from public.ajanlat_megosztasok
  where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and revoked_at is null
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_link');
  end if;

  select * into v_quote
  from public.ajanlatok
  where id = v_link.quote_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'quote_not_found');
  end if;

  if v_link.decision is null and v_link.expires_at < now() then
    update public.ajanlatok
    set quote_status = 'expired'
    where id = v_quote.id and quote_status in ('sent','viewed');
    v_status := 'expired';
  else
    v_status := coalesce(v_link.decision, v_quote.quote_status, 'sent');
    if v_link.opened_at is null then
      update public.ajanlat_megosztasok
      set opened_at = now()
      where id = v_link.id;
      update public.ajanlatok
      set viewed_at = coalesce(viewed_at, now()),
          quote_status = case when quote_status = 'sent' then 'viewed' else quote_status end
      where id = v_quote.id;
      if v_status = 'sent' then v_status := 'viewed'; end if;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', v_status,
    'quote_number', coalesce(
      nullif(v_quote.quote_number, ''),
      nullif(v_quote.payload #>> '{quote_meta,number}', '')
    ),
    'project_name', v_quote.project_name,
    'client_name', v_quote.client_name,
    'client_email', v_quote.client_email,
    'currency', v_quote.currency,
    'total_gross', v_quote.total_gross,
    'valid_until', v_link.expires_at,
    'payload', v_quote.payload,
    'decision_name', v_link.decision_name,
    'decision_comment', v_link.decision_comment,
    'decided_at', v_link.decided_at,
    'terms_version', v_link.terms_version
  );
end;
$$;

create or replace function public.decide_public_quote_v1(
  p_token text,
  p_decision text,
  p_name text,
  p_email text,
  p_comment text default '',
  p_terms_accepted boolean default false,
  p_privacy_accepted boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_link public.ajanlat_megosztasok%rowtype;
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_name text := left(trim(coalesce(p_name, '')), 180);
  v_email text := left(lower(trim(coalesce(p_email, ''))), 240);
  v_comment text := left(trim(coalesce(p_comment, '')), 2000);
begin
  if v_decision not in ('accepted','rejected') then
    raise exception 'Érvénytelen döntés.';
  end if;
  if length(v_name) < 2 then
    raise exception 'Add meg a neved.';
  end if;
  if position('@' in v_email) < 2 then
    raise exception 'Adj meg érvényes e-mail-címet.';
  end if;
  if not coalesce(p_privacy_accepted, false) then
    raise exception 'Az adatkezelési tájékoztatás elfogadása szükséges.';
  end if;
  if v_decision = 'accepted' and not coalesce(p_terms_accepted, false) then
    raise exception 'Az ajánlati feltételek elfogadása szükséges.';
  end if;

  select * into v_link
  from public.ajanlat_megosztasok
  where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and revoked_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_link');
  end if;
  if v_link.decision is not null then
    return jsonb_build_object(
      'ok', true,
      'already_decided', true,
      'decision', v_link.decision,
      'decided_at', v_link.decided_at
    );
  end if;
  if v_link.expires_at < now() then
    update public.ajanlatok
    set quote_status = 'expired'
    where id = v_link.quote_id and quote_status in ('sent','viewed');
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  update public.ajanlat_megosztasok
  set decision = v_decision,
      decision_name = v_name,
      decision_email = v_email,
      decision_comment = nullif(v_comment, ''),
      terms_accepted = coalesce(p_terms_accepted, false),
      privacy_accepted = true,
      decided_at = now()
  where id = v_link.id;

  update public.ajanlatok
  set quote_status = v_decision,
      accepted_at = case when v_decision = 'accepted' then now() else null end,
      rejected_at = case when v_decision = 'rejected' then now() else null end,
      decision_name = v_name,
      decision_email = v_email,
      decision_comment = nullif(v_comment, ''),
      terms_version = v_link.terms_version
  where id = v_link.quote_id;

  return jsonb_build_object(
    'ok', true,
    'decision', v_decision,
    'decided_at', now()
  );
end;
$$;

revoke all on function public.create_quote_share_v1(uuid, integer) from public;
revoke all on function public.get_public_quote_v1(text) from public;
revoke all on function public.decide_public_quote_v1(text, text, text, text, text, boolean, boolean) from public;

grant execute on function public.create_quote_share_v1(uuid, integer) to authenticated;
grant execute on function public.get_public_quote_v1(text) to anon, authenticated;
grant execute on function public.decide_public_quote_v1(text, text, text, text, text, boolean, boolean) to anon, authenticated;
