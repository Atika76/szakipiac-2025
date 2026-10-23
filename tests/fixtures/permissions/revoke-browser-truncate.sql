-- PROPOSAL ONLY: owner approval and backup required. NOT a deployment migration.
-- Exact public-table inventory from 2026-10-19; preserve CRUD, RLS and service_role.
-- TRUNCATE is unnecessary for the inspected application and bypasses RLS.
BEGIN;
-- Per-schema REVOKE cannot subtract a global default grant. The captured live
-- catalogs have no global table defaults for this creator. Fail closed on drift;
-- do not broaden this public-schema proposal to other schemas automatically.
DO $defaults$
BEGIN
 IF EXISTS (
  SELECT 1 FROM pg_catalog.pg_default_acl d
  CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) a
  WHERE d.defaclrole='postgres'::regrole AND d.defaclnamespace=0
   AND d.defaclobjtype='r' AND a.privilege_type='TRUNCATE'
   AND CASE WHEN a.grantee=0 THEN true ELSE
    pg_catalog.pg_has_role('anon',a.grantee,'USAGE') OR pg_catalog.pg_has_role('authenticated',a.grantee,'USAGE') END
 ) THEN
  RAISE EXCEPTION 'Global TRUNCATE default requires separate review for postgres' USING ERRCODE='P0001';
 END IF;
END;
$defaults$;
REVOKE TRUNCATE ON TABLE public."ajanlat_megosztasok" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."ajanlatok" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."analytics_events" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."epitoipari_arak" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."hirdetesek" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."kivitelezes_projektek" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."munkafigyelo_jelentesek" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."reklamok" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."szakember_messages" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."szakember_profiles" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."szakember_ratings" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."szakipiac_360_ai_usage" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."szakipiac_360_entitlements" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."szakipiac_360_payments" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."szakipiac_360_service_requests" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."szakipiac_360_workspace_items" FROM anon,authenticated;
REVOKE TRUNCATE ON TABLE public."user_packages" FROM anon,authenticated;
-- Execute each creator-role default change only with authorized role membership.
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public REVOKE TRUNCATE ON TABLES FROM anon,authenticated;
COMMIT;
