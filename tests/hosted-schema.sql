-- Derived from a read-only hosted catalog, 2026-10-19. Synthetic tests ONLY.
-- No production rows, credentials, role passwords or storage objects.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
-- Scope: affected public tables, their ACL/RLS/functions/triggers. Not a full platform dump.
CREATE TABLE public."ajanlat_megosztasok" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "quote_id" uuid NOT NULL,
 "owner_user_id" uuid NOT NULL,
 "token_hash" text NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "expires_at" timestamp with time zone NOT NULL,
 "opened_at" timestamp with time zone,
 "decided_at" timestamp with time zone,
 "decision" text,
 "decision_name" text,
 "decision_email" text,
 "decision_comment" text,
 "terms_accepted" boolean DEFAULT false NOT NULL,
 "privacy_accepted" boolean DEFAULT false NOT NULL,
 "terms_version" text DEFAULT '2026-07-26-v1'::text NOT NULL,
 "revoked_at" timestamp with time zone
);
CREATE TABLE public."ajanlatok" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "user_id" uuid NOT NULL,
 "user_email" text,
 "project_name" text,
 "client_name" text,
 "client_email" text,
 "client_phone" text,
 "client_city" text,
 "client_address" text,
 "currency" text DEFAULT 'HUF'::text NOT NULL,
 "subtotal_net" numeric DEFAULT 0 NOT NULL,
 "overhead_net" numeric DEFAULT 0 NOT NULL,
 "profit_net" numeric DEFAULT 0 NOT NULL,
 "discount_net" numeric DEFAULT 0 NOT NULL,
 "vat_rate" numeric DEFAULT 0 NOT NULL,
 "vat_amount" numeric DEFAULT 0 NOT NULL,
 "total_gross" numeric DEFAULT 0 NOT NULL,
 "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
 "quote_number" text,
 "quote_status" text DEFAULT 'draft'::text NOT NULL,
 "valid_until" timestamp with time zone,
 "sent_at" timestamp with time zone,
 "viewed_at" timestamp with time zone,
 "accepted_at" timestamp with time zone,
 "rejected_at" timestamp with time zone,
 "decision_name" text,
 "decision_email" text,
 "decision_comment" text,
 "terms_version" text,
 "import_requested_at" timestamp with time zone,
 "import_request_id" text
);
CREATE TABLE public."kivitelezes_projektek" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
 "user_id" uuid,
 "user_email" text,
 "project_name" text DEFAULT 'Névtelen kivitelezési projekt'::text NOT NULL,
 "client_name" text,
 "location" text,
 "total_gross" numeric DEFAULT 0,
 "status" text DEFAULT 'draft'::text NOT NULL,
 "payload" jsonb DEFAULT '{}'::jsonb NOT NULL
);
ALTER TABLE public."ajanlat_megosztasok" ADD CONSTRAINT "ajanlat_megosztasok_decision_check" CHECK (((decision IS NULL) OR (decision = ANY (ARRAY['accepted'::text, 'rejected'::text]))));
ALTER TABLE public."ajanlat_megosztasok" ADD CONSTRAINT "ajanlat_megosztasok_pkey" PRIMARY KEY (id);
ALTER TABLE public."ajanlat_megosztasok" ADD CONSTRAINT "ajanlat_megosztasok_token_hash_key" UNIQUE (token_hash);
ALTER TABLE public."ajanlatok" ADD CONSTRAINT "ajanlatok_pkey" PRIMARY KEY (id);
ALTER TABLE public."ajanlatok" ADD CONSTRAINT "ajanlatok_quote_status_check" CHECK ((quote_status = ANY (ARRAY['draft'::text, 'sent'::text, 'viewed'::text, 'accepted'::text, 'rejected'::text, 'expired'::text])));
ALTER TABLE public."kivitelezes_projektek" ADD CONSTRAINT "kivitelezes_projektek_pkey" PRIMARY KEY (id);
ALTER TABLE public."ajanlat_megosztasok" ADD CONSTRAINT "ajanlat_megosztasok_owner_user_id_fkey" FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."ajanlat_megosztasok" ADD CONSTRAINT "ajanlat_megosztasok_quote_id_fkey" FOREIGN KEY (quote_id) REFERENCES ajanlatok(id) ON DELETE CASCADE;
CREATE INDEX kivitelezes_projektek_user_id_idx ON public.kivitelezes_projektek USING btree (user_id);
CREATE INDEX kivitelezes_projektek_created_at_idx ON public.kivitelezes_projektek USING btree (created_at DESC);
CREATE INDEX idx_ajanlatok_created_at ON public.ajanlatok USING btree (created_at DESC);
CREATE INDEX idx_ajanlatok_user_id ON public.ajanlatok USING btree (user_id);
CREATE INDEX ajanlat_megosztasok_quote_idx ON public.ajanlat_megosztasok USING btree (quote_id, created_at DESC);
CREATE INDEX ajanlat_megosztasok_owner_idx ON public.ajanlat_megosztasok USING btree (owner_user_id, created_at DESC);
CREATE OR REPLACE FUNCTION public.set_kivitelezes_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

begin

  new.updated_at = now();

  return new;

end;

$function$;
CREATE OR REPLACE FUNCTION public.create_quote_share_v1(p_quote_id uuid, p_valid_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
    quote_id, owner_user_id, token_hash, expires_at
  ) values (
    p_quote_id,
    v_quote.user_id,
    encode(digest(v_token, 'sha256'), 'hex'),
    v_expires_at
  );

  update public.ajanlatok
  set quote_status = 'sent',
      quote_number = coalesce(
        nullif(quote_number, ''),
        nullif(payload #>> '{quote_meta,number}', '')
      ),
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
$function$;
CREATE OR REPLACE FUNCTION public.get_public_quote_v1(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_link public.ajanlat_megosztasok%rowtype;
  v_quote public.ajanlatok%rowtype;
  v_status text;
begin
  select * into v_link
  from public.ajanlat_megosztasok
  where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and revoked_at is null
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_link');
  end if;

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

  return jsonb_build_object(
    'ok', true,
    'status', v_status,
    'quote_number', coalesce(
      nullif(v_quote.quote_number, ''),
      nullif(v_quote.payload #>> '{quote_meta,number}', '')
    ),
    'project_name', v_quote.project_name,
    'client_name', v_quote.client_name,
    'client_email', v_quote.client_email,
    'currency', v_quote.currency,
    'total_gross', v_quote.total_gross,
    'valid_until', v_link.expires_at,
    'payload', v_quote.payload,
    'decision_name', v_link.decision_name,
    'decision_comment', v_link.decision_comment,
    'decided_at', v_link.decided_at,
    'terms_version', v_link.terms_version
  );
end;
$function$;
CREATE OR REPLACE FUNCTION public.decide_public_quote_v1(p_token text, p_decision text, p_name text, p_email text, p_comment text DEFAULT ''::text, p_terms_accepted boolean DEFAULT false, p_privacy_accepted boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
    and revoked_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_link');
  end if;
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
$function$;
ALTER TABLE public."ajanlat_megosztasok" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."ajanlat_megosztasok" FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public."ajanlatok" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."ajanlatok" FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public."kivitelezes_projektek" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."kivitelezes_projektek" FROM PUBLIC,anon,authenticated,service_role;
GRANT DELETE ON public."ajanlat_megosztasok" TO "authenticated";
GRANT INSERT ON public."ajanlat_megosztasok" TO "authenticated";
GRANT MAINTAIN ON public."ajanlat_megosztasok" TO "authenticated";
GRANT REFERENCES ON public."ajanlat_megosztasok" TO "authenticated";
GRANT SELECT ON public."ajanlat_megosztasok" TO "authenticated";
GRANT TRIGGER ON public."ajanlat_megosztasok" TO "authenticated";
GRANT TRUNCATE ON public."ajanlat_megosztasok" TO "authenticated";
GRANT UPDATE ON public."ajanlat_megosztasok" TO "authenticated";
GRANT DELETE ON public."ajanlat_megosztasok" TO "service_role";
GRANT INSERT ON public."ajanlat_megosztasok" TO "service_role";
GRANT MAINTAIN ON public."ajanlat_megosztasok" TO "service_role";
GRANT REFERENCES ON public."ajanlat_megosztasok" TO "service_role";
GRANT SELECT ON public."ajanlat_megosztasok" TO "service_role";
GRANT TRIGGER ON public."ajanlat_megosztasok" TO "service_role";
GRANT TRUNCATE ON public."ajanlat_megosztasok" TO "service_role";
GRANT UPDATE ON public."ajanlat_megosztasok" TO "service_role";
GRANT DELETE ON public."ajanlatok" TO "anon";
GRANT INSERT ON public."ajanlatok" TO "anon";
GRANT MAINTAIN ON public."ajanlatok" TO "anon";
GRANT REFERENCES ON public."ajanlatok" TO "anon";
GRANT SELECT ON public."ajanlatok" TO "anon";
GRANT TRIGGER ON public."ajanlatok" TO "anon";
GRANT TRUNCATE ON public."ajanlatok" TO "anon";
GRANT UPDATE ON public."ajanlatok" TO "anon";
GRANT DELETE ON public."ajanlatok" TO "authenticated";
GRANT INSERT ON public."ajanlatok" TO "authenticated";
GRANT MAINTAIN ON public."ajanlatok" TO "authenticated";
GRANT REFERENCES ON public."ajanlatok" TO "authenticated";
GRANT SELECT ON public."ajanlatok" TO "authenticated";
GRANT TRIGGER ON public."ajanlatok" TO "authenticated";
GRANT TRUNCATE ON public."ajanlatok" TO "authenticated";
GRANT UPDATE ON public."ajanlatok" TO "authenticated";
GRANT DELETE ON public."ajanlatok" TO "service_role";
GRANT INSERT ON public."ajanlatok" TO "service_role";
GRANT MAINTAIN ON public."ajanlatok" TO "service_role";
GRANT REFERENCES ON public."ajanlatok" TO "service_role";
GRANT SELECT ON public."ajanlatok" TO "service_role";
GRANT TRIGGER ON public."ajanlatok" TO "service_role";
GRANT TRUNCATE ON public."ajanlatok" TO "service_role";
GRANT UPDATE ON public."ajanlatok" TO "service_role";
GRANT DELETE ON public."kivitelezes_projektek" TO "anon";
GRANT INSERT ON public."kivitelezes_projektek" TO "anon";
GRANT MAINTAIN ON public."kivitelezes_projektek" TO "anon";
GRANT REFERENCES ON public."kivitelezes_projektek" TO "anon";
GRANT SELECT ON public."kivitelezes_projektek" TO "anon";
GRANT TRIGGER ON public."kivitelezes_projektek" TO "anon";
GRANT TRUNCATE ON public."kivitelezes_projektek" TO "anon";
GRANT UPDATE ON public."kivitelezes_projektek" TO "anon";
GRANT DELETE ON public."kivitelezes_projektek" TO "authenticated";
GRANT INSERT ON public."kivitelezes_projektek" TO "authenticated";
GRANT MAINTAIN ON public."kivitelezes_projektek" TO "authenticated";
GRANT REFERENCES ON public."kivitelezes_projektek" TO "authenticated";
GRANT SELECT ON public."kivitelezes_projektek" TO "authenticated";
GRANT TRIGGER ON public."kivitelezes_projektek" TO "authenticated";
GRANT TRUNCATE ON public."kivitelezes_projektek" TO "authenticated";
GRANT UPDATE ON public."kivitelezes_projektek" TO "authenticated";
GRANT DELETE ON public."kivitelezes_projektek" TO "service_role";
GRANT INSERT ON public."kivitelezes_projektek" TO "service_role";
GRANT MAINTAIN ON public."kivitelezes_projektek" TO "service_role";
GRANT REFERENCES ON public."kivitelezes_projektek" TO "service_role";
GRANT SELECT ON public."kivitelezes_projektek" TO "service_role";
GRANT TRIGGER ON public."kivitelezes_projektek" TO "service_role";
GRANT TRUNCATE ON public."kivitelezes_projektek" TO "service_role";
GRANT UPDATE ON public."kivitelezes_projektek" TO "service_role";
REVOKE ALL ON FUNCTION public."set_kivitelezes_updated_at"() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."set_kivitelezes_updated_at"() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public."set_kivitelezes_updated_at"() TO "anon";
GRANT EXECUTE ON FUNCTION public."set_kivitelezes_updated_at"() TO "authenticated";
GRANT EXECUTE ON FUNCTION public."set_kivitelezes_updated_at"() TO "service_role";
REVOKE ALL ON FUNCTION public."create_quote_share_v1"(p_quote_id uuid, p_valid_days integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."create_quote_share_v1"(p_quote_id uuid, p_valid_days integer) TO "anon";
GRANT EXECUTE ON FUNCTION public."create_quote_share_v1"(p_quote_id uuid, p_valid_days integer) TO "authenticated";
GRANT EXECUTE ON FUNCTION public."create_quote_share_v1"(p_quote_id uuid, p_valid_days integer) TO "service_role";
REVOKE ALL ON FUNCTION public."get_public_quote_v1"(p_token text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."get_public_quote_v1"(p_token text) TO "anon";
GRANT EXECUTE ON FUNCTION public."get_public_quote_v1"(p_token text) TO "authenticated";
GRANT EXECUTE ON FUNCTION public."get_public_quote_v1"(p_token text) TO "service_role";
REVOKE ALL ON FUNCTION public."decide_public_quote_v1"(p_token text, p_decision text, p_name text, p_email text, p_comment text, p_terms_accepted boolean, p_privacy_accepted boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public."decide_public_quote_v1"(p_token text, p_decision text, p_name text, p_email text, p_comment text, p_terms_accepted boolean, p_privacy_accepted boolean) TO "anon";
GRANT EXECUTE ON FUNCTION public."decide_public_quote_v1"(p_token text, p_decision text, p_name text, p_email text, p_comment text, p_terms_accepted boolean, p_privacy_accepted boolean) TO "authenticated";
GRANT EXECUTE ON FUNCTION public."decide_public_quote_v1"(p_token text, p_decision text, p_name text, p_email text, p_comment text, p_terms_accepted boolean, p_privacy_accepted boolean) TO "service_role";
CREATE POLICY "kivitelezes_delete_own_or_admin" ON "public"."kivitelezes_projektek" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((user_id = auth.uid()) OR ((auth.jwt() ->> 'email'::text) = 'atika.76@windowslive.com'::text)));
CREATE POLICY "kivitelezes_insert_own" ON "public"."kivitelezes_projektek" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "kivitelezes_select_own_or_admin" ON "public"."kivitelezes_projektek" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((user_id = auth.uid()) OR ((auth.jwt() ->> 'email'::text) = 'atika.76@windowslive.com'::text)));
CREATE POLICY "kivitelezes_update_own_or_admin" ON "public"."kivitelezes_projektek" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((user_id = auth.uid()) OR ((auth.jwt() ->> 'email'::text) = 'atika.76@windowslive.com'::text))) WITH CHECK (((user_id = auth.uid()) OR ((auth.jwt() ->> 'email'::text) = 'atika.76@windowslive.com'::text)));
CREATE POLICY "Ajanlatok - admin delete all" ON "public"."ajanlatok" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((auth.jwt() ->> 'email'::text) = 'atika.76@windowslive.com'::text));
CREATE POLICY "Ajanlatok - admin select all" ON "public"."ajanlatok" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((auth.jwt() ->> 'email'::text) = 'atika.76@windowslive.com'::text));
CREATE POLICY "Ajanlatok - own delete" ON "public"."ajanlatok" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((auth.uid() = user_id));
CREATE POLICY "Ajanlatok - own insert" ON "public"."ajanlatok" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Ajanlatok - own select" ON "public"."ajanlatok" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((auth.uid() = user_id));
CREATE POLICY "ajanlat_megosztasok_owner_select" ON "public"."ajanlat_megosztasok" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((owner_user_id = auth.uid()) OR (lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)) = 'atika.76@windowslive.com'::text)));
CREATE TRIGGER trg_kivitelezes_updated_at BEFORE UPDATE ON public.kivitelezes_projektek FOR EACH ROW EXECUTE FUNCTION set_kivitelezes_updated_at();
