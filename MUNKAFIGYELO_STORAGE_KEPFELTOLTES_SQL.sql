-- SzakiPiac Munkafigyelő - képfeltöltés jogosultság nem-admin felhasználóknak
-- A munkafotók a meglévő hirdetes-kepek bucketbe kerülnek: user_id/munkafigyelo/fajlnev.

begin;

drop policy if exists "hirdetes_kepek_public_read" on storage.objects;
drop policy if exists "hirdetes_kepek_user_insert_own_folder" on storage.objects;
drop policy if exists "hirdetes_kepek_user_update_own_folder" on storage.objects;
drop policy if exists "hirdetes_kepek_user_delete_own_folder" on storage.objects;

create policy "hirdetes_kepek_public_read"
on storage.objects
for select
to public
using (bucket_id = 'hirdetes-kepek');

create policy "hirdetes_kepek_user_insert_own_folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'hirdetes-kepek'
  and (
    public.is_szakipiac_admin()
    or (storage.foldername(name))[1] = auth.uid()::text
  )
);

create policy "hirdetes_kepek_user_update_own_folder"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'hirdetes-kepek'
  and (
    public.is_szakipiac_admin()
    or (storage.foldername(name))[1] = auth.uid()::text
  )
)
with check (
  bucket_id = 'hirdetes-kepek'
  and (
    public.is_szakipiac_admin()
    or (storage.foldername(name))[1] = auth.uid()::text
  )
);

create policy "hirdetes_kepek_user_delete_own_folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'hirdetes-kepek'
  and (
    public.is_szakipiac_admin()
    or (storage.foldername(name))[1] = auth.uid()::text
  )
);

commit;
