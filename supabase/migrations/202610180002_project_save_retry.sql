-- PR #9 review: safe retries after lost INSERT or UPDATE responses.
begin;
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
   -- A request may have committed while its HTTP response was lost. Only the
   -- immediate next revision with identical BUSINESS content is a safe retry.
   -- Ignore saved_at only; compare all scalar fields as well as the payload.
   if v.revision=coalesce(p_revision,0)+1 and
     (v.project_name,v.client_name,v.location,v.total_gross,v.source_quote_id,v.payload-'saved_at')
     is not distinct from
     (coalesce(p_row->>'project_name','Névtelen projekt'),p_row->>'client_name',p_row->>'location',
      (p_row->>'total_gross')::numeric,source_id,(p_row->'payload')-'saved_at') then
     return to_jsonb(v);
   end if;
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

commit;
