CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.invoke_cotani_notification_job()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions, net, vault
AS $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cotani_app_url' LIMIT 1) || '/api/jobs/notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cotani_cron_secret' LIMIT 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
$$;

REVOKE ALL ON FUNCTION public.invoke_cotani_notification_job() FROM PUBLIC;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'cotani-notification-dispatch';

SELECT cron.schedule(
  'cotani-notification-dispatch',
  '*/5 * * * *',
  'SELECT public.invoke_cotani_notification_job()'
);
