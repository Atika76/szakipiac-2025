-- LOCAL PRO+ work version only. Not applied to a hosted/production database.
-- Replaces only the existing share RPC; CREATE OR REPLACE preserves its ACL.
begin;

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

  -- Fail closed for malformed enabled flags as well as the detailed draft.
  -- Ownership is checked above; no status/link writes have happened yet.
  if coalesce(v_quote.payload #> '{building_budget,enabled}', 'false'::jsonb)
       not in ('false'::jsonb, 'null'::jsonb) then
    raise exception using errcode = '0A000',
      message = 'A reszletes koltsegvetesi munkavaltozat ugyfelmegosztasa meg nem tamogatott.';
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
    quote_id, owner_user_id, token_hash, expires_at, quote_snapshot
  ) values (
    p_quote_id,
    v_quote.user_id,
    encode(digest(v_token, 'sha256'), 'hex'),
    v_expires_at,
    to_jsonb(v_quote)
  );

  update public.ajanlatok
  set quote_status = 'sent',
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

commit;
