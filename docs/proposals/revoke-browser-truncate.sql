-- PROPOSAL ONLY: owner approval and backup required. NOT a deployment migration.
-- Exact public-table inventory from 2026-10-19; preserve CRUD, RLS and service_role.
-- TRUNCATE is unnecessary for the inspected application and bypasses RLS.
BEGIN;
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
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public REVOKE TRUNCATE ON TABLES FROM anon,authenticated;
COMMIT;
