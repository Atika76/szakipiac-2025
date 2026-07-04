-- SzakiPiac - admin altal adhato felhasznaloi csomagok
-- Futtasd a Supabase SQL Editorban.

create table if not exists public.user_packages (
  user_id uuid primary key references auth.users(id) on delete cascade,
  csomag text not null check (csomag in ('alap', 'premium', 'extra')),
  expires_at timestamptz not null,
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_packages_expires_at
on public.user_packages (expires_at desc);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_user_packages_updated on public.user_packages;
create trigger trg_user_packages_updated
before update on public.user_packages
for each row execute function public.set_updated_at();

alter table public.user_packages enable row level security;

drop policy if exists "user_packages_owner_or_admin_read" on public.user_packages;
create policy "user_packages_owner_or_admin_read"
on public.user_packages
for select
to authenticated
using (
  auth.uid() = user_id
  or auth.jwt() ->> 'email' = 'atika.76@windowslive.com'
);

drop policy if exists "user_packages_admin_insert" on public.user_packages;
create policy "user_packages_admin_insert"
on public.user_packages
for insert
to authenticated
with check (auth.jwt() ->> 'email' = 'atika.76@windowslive.com');

drop policy if exists "user_packages_admin_update" on public.user_packages;
create policy "user_packages_admin_update"
on public.user_packages
for update
to authenticated
using (auth.jwt() ->> 'email' = 'atika.76@windowslive.com')
with check (auth.jwt() ->> 'email' = 'atika.76@windowslive.com');

drop policy if exists "user_packages_admin_delete" on public.user_packages;
create policy "user_packages_admin_delete"
on public.user_packages
for delete
to authenticated
using (auth.jwt() ->> 'email' = 'atika.76@windowslive.com');

-- Ha a hirdetesek tablan RLS van, ez engedi az adminnak az aktiv hirdetesek csomag/frissites muveletet.
-- Ha nalad mar van ilyen policy, ez csak lecsereli ugyanilyen neven.
-- Nem kapcsoljuk be automatikusan az RLS-t a hirdetesek tablan, nehogy egy meglevo nyitott tabla mukodeset megvaltoztassa.

drop policy if exists "hirdetesek_admin_update" on public.hirdetesek;
create policy "hirdetesek_admin_update"
on public.hirdetesek
for update
to authenticated
using (auth.jwt() ->> 'email' = 'atika.76@windowslive.com')
with check (auth.jwt() ->> 'email' = 'atika.76@windowslive.com');

drop policy if exists "hirdetesek_admin_delete" on public.hirdetesek;
create policy "hirdetesek_admin_delete"
on public.hirdetesek
for delete
to authenticated
using (auth.jwt() ->> 'email' = 'atika.76@windowslive.com');
