-- SzakiPiac 360: jogosultsagok, AI napi keret, szolgaltatas-igenyek es fizetesi naplo.
-- A tablaalapu megoldas a Supabase ingyenes csomagjaban is kis eroforrasigenyu.

create table if not exists public.szakipiac_360_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', '360')),
  expires_at timestamptz,
  source text not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  elsif exists (
    select 1 from public.szakipiac_360_entitlements e
    where e.user_id = v_user and e.plan = '360'
      and (e.expires_at is null or e.expires_at >= now())
  ) then
    v_plan := '360';
    v_limit := 20;
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
