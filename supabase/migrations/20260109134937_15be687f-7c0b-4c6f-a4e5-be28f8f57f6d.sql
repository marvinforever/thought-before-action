-- Update the cron job to run only at 7am UTC instead of every hour
SELECT cron.unschedule('process-daily-brief-hourly');
SELECT cron.unschedule('process-daily-brief-queue-hourly');

-- Schedule to run at 7am UTC (12:00 CST / 1:00 CDT / 2:00 EST / 3:00 PST)
-- This means for US Central Time it will be around 1-2am, which is early
-- Let's use 12:00 UTC which is 7am EST / 6am CST
SELECT cron.schedule(
  'daily-brief-7am',
  '0 12 * * *',  -- 12:00 UTC = 7am EST / 6am CST
  $$
  SELECT net.http_post(
    url := 'https://aiihzjkspwsriktvrdle.supabase.co/functions/v1/process-daily-brief-queue',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);