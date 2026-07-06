-- SzakiPiac Munkafigyelő - napi kétszeri automatikus frissítés
-- Ezt a Supabase SQL Editorban kell lefuttatni.
--
-- FONTOS ELŐTTE:
-- 1) A Supabase Edge Function Secrets részen állíts be egy titkos jelszót:
--    MUNKAFIGYELO_COLLECTOR_SECRET = valami-hosszu-titkos-szoveg
-- 2) Ugyanezt a titkos szöveget írd be lent az IDE_IRD_BE_A_TITKOS_SZOVEGET helyére.
-- 3) A munkafigyelo-collector Edge Function legyen deployolva.
--
-- Időzítés:
-- '0 5,17 * * *' = naponta kétszer, 05:00 és 17:00 UTC szerint.
-- Magyar nyári időben ez kb. 07:00 és 19:00.
-- Magyar téli időben kb. 06:00 és 18:00.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Ha már létezik ilyen ütemezés, előbb töröljük, hogy ne legyen dupla futás.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'munkafigyelo-collector-napi-2x') then
    perform cron.unschedule('munkafigyelo-collector-napi-2x');
  end if;
end $$;

-- Napi kétszeri Munkafigyelő gyűjtés.
select cron.schedule(
  'munkafigyelo-collector-napi-2x',
  '0 5,17 * * *',
  $$
  select net.http_post(
    url := 'https://bxtpnotswnwrbycvfypz.supabase.co/functions/v1/munkafigyelo-collector',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-collector-secret', 'IDE_IRD_BE_A_TITKOS_SZOVEGET'
    ),
    body := jsonb_build_object(
      'trigger', 'cron',
      'frequency', 'daily_2x',
      'called_at', now()
    )
  ) as request_id;
  $$
);

-- Ellenőrzés: itt látod, hogy létrejött-e az ütemezés.
select jobid, jobname, schedule, active
from cron.job
where jobname = 'munkafigyelo-collector-napi-2x';

-- Ha valamikor törölni akarod:
-- select cron.unschedule('munkafigyelo-collector-napi-2x');
