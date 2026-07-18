-- SzakiPiac 360: jogosultsagok, AI napi keret, szolgaltatas-igenyek es fizetesi naplo.
-- A tablaalapu megoldas a Supabase ingyenes csomagjaban is kis eroforrasigenyu.

create table if not exists public.szakipiac_360_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'basic', 'pro')),
  expires_at timestamptz,
  source text not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.szakipiac_360_entitlements drop constraint if exists szakipiac_360_entitlements_plan_check;
-- A korábbi egyetlen 360 csomag PRO-ként él tovább, a meglévő lejárattal.
update public.szakipiac_360_entitlements set plan = 'pro' where plan = '360';
alter table public.szakipiac_360_entitlements
  add constraint szakipiac_360_entitlements_plan_check check (plan in ('free', 'basic', 'pro'));

alter table public.szakipiac_360_entitlements enable row level security;
grant select on public.szakipiac_360_entitlements to authenticated;
grant insert, update, delete on public.szakipiac_360_entitlements to authenticated;

drop policy if exists "szakipiac_360_entitlements_read" on public.szakipiac_360_entitlements;
create policy "szakipiac_360_entitlements_read"
on public.szakipiac_360_entitlements for select to authenticated
using (auth.uid() = user_id or lower(coalesce(auth.jwt() ->> 'email','')) = 'atika.76@windowslive.com');

drop policy if exists "szakipiac_360_entitlements_admin_all" on public.szakipiac_360_entitlements;
create policy "szakipiac_360_entitlements_admin_all"
on public.szakipiac_360_entitlements for all to authenticated
using (lower(coalesce(auth.jwt() ->> 'email','')) = 'atika.76@windowslive.com')
with check (lower(coalesce(auth.jwt() ->> 'email','')) = 'atika.76@windowslive.com');

create table if not exists public.szakipiac_360_ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

alter table public.szakipiac_360_ai_usage enable row level security;
grant select on public.szakipiac_360_ai_usage to authenticated;

drop policy if exists "szakipiac_360_ai_usage_read" on public.szakipiac_360_ai_usage;
create policy "szakipiac_360_ai_usage_read"
on public.szakipiac_360_ai_usage for select to authenticated
using (auth.uid() = user_id or lower(coalesce(auth.jwt() ->> 'email','')) = 'atika.76@windowslive.com');

create or replace function public.szakipiac_360_consume_ai(p_mode text default 'quick')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email',''));
  v_plan text := 'free';
  v_limit integer := 3;
  v_count integer := 0;
begin
  if v_user is null then
    raise exception 'Az AI hasznalatahoz jelentkezz be.' using errcode = '42501';
  end if;

  if v_email = 'atika.76@windowslive.com' then
    v_plan := 'admin';
    v_limit := 10000;
  else
    select e.plan into v_plan
    from public.szakipiac_360_entitlements e
    where e.user_id = v_user and e.plan in ('basic','pro')
      and (e.expires_at is null or e.expires_at >= now());
    if v_plan = 'basic' then v_limit := 10;
    elsif v_plan = 'pro' then v_limit := 20;
    else v_plan := 'free'; v_limit := 3;
    end if;
  end if;

  insert into public.szakipiac_360_ai_usage(user_id, usage_date, request_count, updated_at)
  values (v_user, current_date, 1, now())
  on conflict (user_id, usage_date) do update
    set request_count = public.szakipiac_360_ai_usage.request_count + 1,
        updated_at = now()
    where public.szakipiac_360_ai_usage.request_count < v_limit
  returning request_count into v_count;

  if v_count is null then
    select request_count into v_count
    from public.szakipiac_360_ai_usage
    where user_id = v_user and usage_date = current_date;
    return jsonb_build_object('allowed', false, 'plan', v_plan, 'limit', v_limit, 'used', coalesce(v_count, 0), 'remaining', 0);
  end if;

  return jsonb_build_object('allowed', true, 'plan', v_plan, 'limit', v_limit, 'used', v_count, 'remaining', greatest(v_limit - v_count, 0), 'mode', coalesce(p_mode, 'quick'));
end;
$$;

revoke all on function public.szakipiac_360_consume_ai(text) from public, anon;
grant execute on function public.szakipiac_360_consume_ai(text) to authenticated;

create table if not exists public.szakipiac_360_service_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text,
  service_type text not null check (service_type in ('weboldal','messenger','ai_chatbot','facebook','google_cegprofil','ajanlatkero')),
  details text not null check (length(details) between 10 and 4000),
  contact text,
  budget text,
  status text not null default 'uj' check (status in ('uj','egyeztetes','ajanlat','folyamatban','lezart','elutasitva')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.szakipiac_360_service_requests enable row level security;
grant select, insert, update, delete on public.szakipiac_360_service_requests to authenticated;

drop policy if exists "szakipiac_360_service_requests_read" on public.szakipiac_360_service_requests;
create policy "szakipiac_360_service_requests_read"
on public.szakipiac_360_service_requests for select to authenticated
using (auth.uid() = user_id or lower(coalesce(auth.jwt() ->> 'email','')) = 'atika.76@windowslive.com');

drop policy if exists "szakipiac_360_service_requests_insert" on public.szakipiac_360_service_requests;
create policy "szakipiac_360_service_requests_insert"
on public.szakipiac_360_service_requests for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "szakipiac_360_service_requests_admin_update" on public.szakipiac_360_service_requests;
create policy "szakipiac_360_service_requests_admin_update"
on public.szakipiac_360_service_requests for update to authenticated
using (lower(coalesce(auth.jwt() ->> 'email','')) = 'atika.76@windowslive.com')
with check (lower(coalesce(auth.jwt() ->> 'email','')) = 'atika.76@windowslive.com');

drop policy if exists "szakipiac_360_service_requests_owner_delete" on public.szakipiac_360_service_requests;
create policy "szakipiac_360_service_requests_owner_delete"
on public.szakipiac_360_service_requests for delete to authenticated
using (auth.uid() = user_id or lower(coalesce(auth.jwt() ->> 'email','')) = 'atika.76@windowslive.com');

-- A PayPal szerveroldali ellenorzes kesobbi bekotese ehhez a naplohoz irhat.
-- A kliens kozvetlenul nem irhat bele, csak service-role Edge Function.
create table if not exists public.szakipiac_360_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  provider text not null default 'paypal',
  provider_order_id text unique,
  product_code text not null,
  amount numeric not null check (amount >= 0),
  currency text not null default 'HUF',
  status text not null default 'pending' check (status in ('pending','completed','failed','refunded')),
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.szakipiac_360_payments enable row level security;
grant select on public.szakipiac_360_payments to authenticated;

drop policy if exists "szakipiac_360_payments_read" on public.szakipiac_360_payments;
create policy "szakipiac_360_payments_read"
on public.szakipiac_360_payments for select to authenticated
using (auth.uid() = user_id or lower(coalesce(auth.jwt() ->> 'email','')) = 'atika.76@windowslive.com');

-- Egyetlen kozos munkater a 360 kiegeszito rekordokhoz.
-- Az ajanlatok es a KivitelezesPRO projektek tovabbra is a sajat, mar letezo tablaikban maradnak.
create table if not exists public.szakipiac_360_workspace_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('document','material','profit','quote_text')),
  title text not null check (length(title) between 2 and 200),
  source_type text,
  source_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.szakipiac_360_workspace_items enable row level security;
grant select, update, delete on public.szakipiac_360_workspace_items to authenticated;

drop policy if exists "szakipiac_360_workspace_read" on public.szakipiac_360_workspace_items;
create policy "szakipiac_360_workspace_read"
on public.szakipiac_360_workspace_items for select to authenticated
using (auth.uid() = user_id or lower(coalesce(auth.jwt() ->> 'email','')) = 'atika.76@windowslive.com');

drop policy if exists "szakipiac_360_workspace_update" on public.szakipiac_360_workspace_items;
create policy "szakipiac_360_workspace_update"
on public.szakipiac_360_workspace_items for update to authenticated
using (auth.uid() = user_id or lower(coalesce(auth.jwt() ->> 'email','')) = 'atika.76@windowslive.com')
with check (auth.uid() = user_id or lower(coalesce(auth.jwt() ->> 'email','')) = 'atika.76@windowslive.com');

drop policy if exists "szakipiac_360_workspace_delete" on public.szakipiac_360_workspace_items;
create policy "szakipiac_360_workspace_delete"
on public.szakipiac_360_workspace_items for delete to authenticated
using (auth.uid() = user_id or lower(coalesce(auth.jwt() ->> 'email','')) = 'atika.76@windowslive.com');

create index if not exists szakipiac_360_workspace_user_idx
on public.szakipiac_360_workspace_items(user_id, created_at desc);
create unique index if not exists szakipiac_360_workspace_source_unique
on public.szakipiac_360_workspace_items(user_id, item_type, source_type, source_id)
where source_id is not null;

create or replace function public.szakipiac_360_save_workspace_item(
  p_item_type text,
  p_title text,
  p_payload jsonb default '{}'::jsonb,
  p_source_type text default null,
  p_source_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_is_admin boolean := lower(coalesce(auth.jwt() ->> 'email','')) = 'atika.76@windowslive.com';
  v_plan text := 'free';
  v_count integer := 0;
  v_id uuid;
begin
  if v_user is null then raise exception 'A menteshez jelentkezz be.' using errcode = '42501'; end if;
  if p_item_type not in ('document','material','profit','quote_text') then raise exception 'Ismeretlen munkater-tipus.'; end if;
  if length(trim(coalesce(p_title,''))) < 2 then raise exception 'Adj meg cimet.'; end if;

  select e.plan into v_plan from public.szakipiac_360_entitlements e
  where e.user_id = v_user and e.plan in ('basic','pro') and (e.expires_at is null or e.expires_at >= now());
  v_plan := coalesce(v_plan, 'free');

  if not v_is_admin and v_plan <> 'pro' and p_source_id is null then
    select count(*) into v_count from public.szakipiac_360_workspace_items where user_id = v_user;
    if (v_plan = 'free' and v_count >= 3) or (v_plan = 'basic' and v_count >= 30) then
      raise exception 'Elerted a csomagod mentesi keretet. A 360 Alap 30, a 360 PRO korlatlan munkater-mentest ad.' using errcode = 'P0001';
    end if;
  end if;

  if p_source_id is not null then
    insert into public.szakipiac_360_workspace_items(user_id,item_type,title,source_type,source_id,payload)
    values(v_user,p_item_type,left(trim(p_title),200),p_source_type,p_source_id,coalesce(p_payload,'{}'::jsonb))
    on conflict (user_id,item_type,source_type,source_id) where source_id is not null
    do update set title=excluded.title,payload=excluded.payload,updated_at=now()
    returning id into v_id;
  else
    insert into public.szakipiac_360_workspace_items(user_id,item_type,title,source_type,source_id,payload)
    values(v_user,p_item_type,left(trim(p_title),200),p_source_type,p_source_id,coalesce(p_payload,'{}'::jsonb))
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

revoke all on function public.szakipiac_360_save_workspace_item(text,text,jsonb,text,uuid) from public, anon;
grant execute on function public.szakipiac_360_save_workspace_item(text,text,jsonb,text,uuid) to authenticated;

-- Az elso 15 uj 360-felhasznalo egyszeri, 30 napos udvozlo hozzaferese.
create or replace function public.szakipiac_360_claim_welcome()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_ent public.szakipiac_360_entitlements%rowtype;
  v_welcome_count integer;
begin
  if v_user is null then raise exception 'Jelentkezz be.' using errcode = '42501'; end if;
  if lower(coalesce(auth.jwt() ->> 'email','')) = 'atika.76@windowslive.com' then
    return jsonb_build_object('granted',false,'plan','admin','remaining',15);
  end if;
  perform pg_advisory_xact_lock(hashtext('szakipiac_360_first_15'));
  select * into v_ent from public.szakipiac_360_entitlements where user_id = v_user;
  if found then
    return jsonb_build_object('granted',false,'plan',v_ent.plan,'expires_at',v_ent.expires_at,'source',v_ent.source);
  end if;
  select count(*) into v_welcome_count from public.szakipiac_360_entitlements where source = 'welcome_first_15';
  if v_welcome_count >= 15 then
    return jsonb_build_object('granted',false,'plan','free','remaining',0);
  end if;
  insert into public.szakipiac_360_entitlements(user_id,plan,expires_at,source)
  values(v_user,'pro',now()+interval '30 days','welcome_first_15')
  returning * into v_ent;
  return jsonb_build_object('granted',true,'plan','pro','expires_at',v_ent.expires_at,'remaining',greatest(14-v_welcome_count,0));
end;
$$;

revoke all on function public.szakipiac_360_claim_welcome() from public, anon;
grant execute on function public.szakipiac_360_claim_welcome() to authenticated;
