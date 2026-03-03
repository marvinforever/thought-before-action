-- Fix the cron job to include Authorization header like other working crons
SELECT cron.unschedule('daily-brief-7am');

SELECT cron.schedule(
  'daily-brief-7am',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://aiihzjkspwsriktvrdle.supabase.co/functions/v1/process-daily-brief-queue',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpaWh6amtzcHdzcmlrdHZyZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxNzI4MzMsImV4cCI6MjA3NDc0ODgzM30.Vou6Kgn5RQvH2VBmNp7RZqUr0XW98hy4NOi7AhpgBtQ"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);