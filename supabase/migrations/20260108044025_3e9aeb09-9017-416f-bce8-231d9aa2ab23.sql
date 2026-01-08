-- Schedule hourly processing of daily briefs using pg_cron + pg_net
-- (Fixes: use a different dollar-quote tag for the job command)

DO $$
DECLARE
  existing_job_id integer;
BEGIN
  SELECT jobid INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'process-daily-brief-queue-hourly'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'process-daily-brief-queue-hourly',
    '0 * * * *',
    $cmd$
      SELECT net.http_post(
        url := 'https://aiihzjkspwsriktvrdle.functions.supabase.co/process-daily-brief-queue',
        headers := '{"Content-Type":"application/json"}'::jsonb,
        body := '{}'::jsonb
      );
    $cmd$
  );
END $$;