-- A nyilvános tartalom olvasható marad, de értékelést és üzenetet
-- csak bejelentkezett SzakiPiac-felhasználó hozhat létre.

drop policy if exists "ratings_public_insert" on public.szakember_ratings;
create policy "ratings_public_insert"
on public.szakember_ratings
for insert
to authenticated
with check (
  auth.uid() is not null
  and visitor_id is not null
  and length(visitor_id) > 5
  and user_id is not null
  and stars between 1 and 5
);

drop policy if exists "messages_public_insert" on public.szakember_messages;
create policy "messages_public_insert"
on public.szakember_messages
for insert
to authenticated
with check (
  auth.uid() is not null
  and to_user_id is not null
  and from_visitor_id is not null
  and length(from_visitor_id) > 5
  and message is not null
  and length(message) > 1
);
