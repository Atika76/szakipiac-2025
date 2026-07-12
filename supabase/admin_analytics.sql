-- Admin-only oldalmegtekintési statisztika nullázás.
create or replace function public.admin_reset_pageview_stats()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count bigint;
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'atika.76@windowslive.com' then
    raise exception 'Nincs admin jogosultságod.' using errcode = '42501';
  end if;

  with deleted as (
    delete from public.analytics_events
    where event_type = 'page_view'
    returning 1
  )
  select count(*) into deleted_count from deleted;

  return deleted_count;
end;
$$;

revoke all on function public.admin_reset_pageview_stats() from public, anon;
grant execute on function public.admin_reset_pageview_stats() to authenticated;
