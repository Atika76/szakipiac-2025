-- Issue #8. Additive, repeatable; run only after approved schema preflight.
begin;
alter table public.ajanlatok add column if not exists parent_quote_id uuid references public.ajanlatok(id);
alter table public.ajanlat_megosztasok add column if not exists quote_snapshot jsonb;
alter table public.kivitelezes_projektek add column if not exists source_quote_id uuid references public.ajanlatok(id);
alter table public.kivitelezes_projektek add column if not exists revision integer not null default 1;

grant update on public.ajanlatok to authenticated;

-- Live preflight found no UPDATE policy on ajanlatok. Add one without replacing
-- the existing SELECT/INSERT/DELETE policies. Trigger guards state and content.
drop policy if exists "ajanlatok_workflow_v2_update" on public.ajanlatok;
create policy "ajanlatok_workflow_v2_update" on public.ajanlatok for update to authenticated
using (user_id=auth.uid() or lower(coalesce(auth.jwt()->>'email',''))='atika.76@windowslive.com')
with check (user_id=auth.uid() or lower(coalesce(auth.jwt()->>'email',''))='atika.76@windowslive.com');

-- System metadata is excluded; all other present/future content columns are protected.
create or replace function public.quote_content_v2(p_row jsonb) returns jsonb
language sql immutable set search_path = pg_catalog as $$
 select p_row - array['updated_at','quote_status','valid_until','sent_at','viewed_at',
 'accepted_at','rejected_at','decision_name','decision_email','decision_comment','terms_version',
 'import_requested_at','import_request_id']::text[];
$$;

-- INVOKER is intentional: current_user is the definer only inside the trusted RPCs.
-- A request GUC or a client-supplied email cannot bypass this guard.
create or replace function public.guard_quote_workflow_v2() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare v_parent public.ajanlatok%rowtype;
begin
 if TG_OP = 'DELETE' then
  if old.quote_status = 'accepted' then raise exception 'Az elfogadott ajánlat nem törölhető.'; end if;
  return old;
 end if;
 if TG_OP = 'INSERT' then
  if current_user in ('anon','authenticated') and
   (new.quote_status <> 'draft' or new.accepted_at is not null or new.rejected_at is not null
    or new.sent_at is not null or new.viewed_at is not null or new.decision_name is not null
    or new.decision_email is not null or new.decision_comment is not null
    or new.terms_version is not null or new.import_requested_at is not null
    or new.import_request_id is not null) then
   raise exception 'Az ajánlat állapotát csak a szerver kezelheti.';
  end if;
  if new.parent_quote_id is not null then
   select * into v_parent from public.ajanlatok where id = new.parent_quote_id;
   if not found or v_parent.user_id is distinct from new.user_id or new.parent_quote_id = new.id then
    raise exception 'Érvénytelen ajánlatverzió-kapcsolat.';
   end if;
  end if;
 else
  if new.id <> old.id or new.user_id is distinct from old.user_id
    or new.user_email is distinct from old.user_email or new.parent_quote_id is distinct from old.parent_quote_id then
   raise exception 'Az ajánlat azonosítója és tulajdonosa nem módosítható.';
  end if;
  if old.quote_status <> 'draft' and public.quote_content_v2(to_jsonb(new)) is distinct from public.quote_content_v2(to_jsonb(old)) then
   raise exception 'A kiküldött vagy lezárt ajánlat tartalma rögzített. Készíts új verziót.';
  end if;
  if current_user in ('anon','authenticated') and
   (new.quote_status,new.valid_until,new.sent_at,new.viewed_at,new.accepted_at,new.rejected_at,
    new.decision_name,new.decision_email,new.decision_comment,new.terms_version,new.import_requested_at,new.import_request_id)
   is distinct from
   (old.quote_status,old.valid_until,old.sent_at,old.viewed_at,old.accepted_at,old.rejected_at,
    old.decision_name,old.decision_email,old.decision_comment,old.terms_version,old.import_requested_at,old.import_request_id) then
   raise exception 'Az ajánlat állapotát csak a szerver kezelheti.';
  end if;
 end if;
 return new;
end; $$;
drop trigger if exists guard_quote_workflow_v2 on public.ajanlatok;
create trigger guard_quote_workflow_v2 before insert or update or delete on public.ajanlatok
for each row execute function public.guard_quote_workflow_v2();

-- UUID ownership is authoritative. Admin email comes only from the signed JWT.
create or replace function public.save_kivitelezes_project_v2(p_id uuid, p_revision integer, p_row jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v public.kivitelezes_projektek%rowtype; q public.ajanlatok%rowtype;
 uid uuid := auth.uid(); is_admin boolean := lower(coalesce(auth.jwt()->>'email','')) = 'atika.76@windowslive.com';
 source_id uuid := nullif(p_row->>'source_quote_id','')::uuid;
begin
 if uid is null then raise exception 'Bejelentkezés szükséges.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('kiv:' || p_id::text,0));
 select * into v from public.kivitelezes_projektek where id=p_id for update;
 if found then
  if v.user_id is distinct from uid and not is_admin then raise exception 'Nincs jogosultság.'; end if;
  if p_revision is distinct from v.revision then
   -- Safe retry after a lost INSERT response, with exactly the same content.
   if p_revision is null and v.revision=1 and v.payload=p_row->'payload'
     and v.source_quote_id is not distinct from source_id then return to_jsonb(v); end if;
   raise exception 'A projekt időközben változott. Töltsd be újra.';
  end if;
 elsif p_revision is not null then raise exception 'A projekt nem található; töltsd be újra.';
 end if;
 if source_id is not null then
  select * into q from public.ajanlatok where id=source_id;
  if not found or q.user_id is distinct from coalesce(v.user_id,uid) then
   raise exception 'Az ajánlat és a projekt tulajdonosának egyeznie kell.';
  end if;
 end if;
 if v.id is null then
  insert into public.kivitelezes_projektek(id,user_id,user_email,project_name,client_name,location,total_gross,status,payload,source_quote_id)
  values(p_id,uid,auth.jwt()->>'email',coalesce(p_row->>'project_name','Névtelen projekt'),p_row->>'client_name',
   p_row->>'location',(p_row->>'total_gross')::numeric,'draft',p_row->'payload',source_id) returning * into v;
 else
  update public.kivitelezes_projektek set project_name=p_row->>'project_name',client_name=p_row->>'client_name',
   location=p_row->>'location',total_gross=(p_row->>'total_gross')::numeric,payload=p_row->'payload',
   source_quote_id=source_id,revision=revision+1,updated_at=now() where id=p_id returning * into v;
 end if;
 return to_jsonb(v);
end; $$;
revoke all on function public.save_kivitelezes_project_v2(uuid,integer,jsonb) from public, anon;
grant execute on function public.save_kivitelezes_project_v2(uuid,integer,jsonb) to authenticated;

-- Direct legacy writes retain RLS and also invalidate optimistic revision tokens.
create or replace function public.guard_kivitelezes_project_v2() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
 if TG_OP='UPDATE' then
  if new.id<>old.id or new.user_id is distinct from old.user_id or new.user_email is distinct from old.user_email then
   raise exception 'A projekt tulajdonosa nem módosítható.';
  end if;
  new.revision := old.revision+1;
 end if;
 if new.source_quote_id is not null and not exists (
  select 1 from public.ajanlatok q where q.id=new.source_quote_id and q.user_id=new.user_id
 ) then raise exception 'Érvénytelen ajánlatkapcsolat.'; end if;
 return new;
end; $$;
drop trigger if exists guard_kivitelezes_project_v2 on public.kivitelezes_projektek;
create trigger guard_kivitelezes_project_v2 before insert or update on public.kivitelezes_projektek
for each row execute function public.guard_kivitelezes_project_v2();
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
  v_snapshot jsonb;
begin
  select * into v_link
  from public.ajanlat_megosztasok
  where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and revoked_at is null
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_link');
  end if;
  perform 1 from public.ajanlatok where id=v_link.quote_id for update;
  select * into v_link from public.ajanlat_megosztasok where id=v_link.id and revoked_at is null for update;
  if not found then return jsonb_build_object('ok',false,'error','invalid_link'); end if;


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

  v_snapshot := coalesce(v_link.quote_snapshot,to_jsonb(v_quote));
  return jsonb_build_object(
    'ok', true,
    'status', v_status,
    'quote_number', coalesce(
      nullif(v_quote.quote_number, ''),
      nullif(v_snapshot->'payload' #>> '{quote_meta,number}', '')
    ),
    'project_name', v_snapshot->'project_name',
    'client_name', v_snapshot->'client_name',
    'client_email', v_snapshot->'client_email',
    'currency', v_snapshot->'currency',
    'total_gross', v_snapshot->'total_gross',
    'valid_until', v_link.expires_at,
    'payload', v_snapshot->'payload',
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
    and revoked_at is null;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_link');
  end if;
  perform 1 from public.ajanlatok where id=v_link.quote_id for update;
  select * into v_link from public.ajanlat_megosztasok where id=v_link.id and revoked_at is null for update;
  if not found then return jsonb_build_object('ok',false,'error','invalid_link'); end if;

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

commit;
