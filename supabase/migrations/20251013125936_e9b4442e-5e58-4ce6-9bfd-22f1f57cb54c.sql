-- Enable required extensions for scheduled emails
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant necessary permissions to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Create the cron job to process email queue every hour
SELECT cron.schedule(
  'process-growth-emails',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT net.http_post(
    url:='https://aiihzjkspwsriktvrdle.supabase.co/functions/v1/process-email-queue',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpaWh6amtzcHdzcmlrdHZyZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxNzI4MzMsImV4cCI6MjA3NDc0ODgzM30.Vou6Kgn5RQvH2VBmNp7RZqUr0XW98hy4NOi7AhpgBtQ"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);