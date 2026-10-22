-- Owner approval required before production. Preserves all quote/acceptance data.
begin;
alter table public.ajanlatok add column if not exists archived_at timestamptz;
do $archive$
begin
 if not exists (
  select 1 from information_schema.columns
  where table_schema='public' and table_name='ajanlatok'
    and column_name='archived_at' and data_type='timestamp with time zone'
 ) then raise exception 'Az archived_at oszlop típusa nem kompatibilis.'; end if;
end;
$archive$;

-- Only this UI metadata field is newly excluded. The existing trigger and RLS
-- still protect identity, content, acceptance, status and ownership.
create or replace function public.quote_content_v2(p_row jsonb) returns jsonb
language sql immutable set search_path = pg_catalog as $$
 select p_row - array['updated_at','quote_status','valid_until','sent_at','viewed_at',
 'accepted_at','rejected_at','decision_name','decision_email','decision_comment','terms_version',
 'import_requested_at','import_request_id','archived_at']::text[];
$$;
commit;
