DO $$
DECLARE
  legacy_job_id integer;
BEGIN
  SELECT jobid INTO legacy_job_id
  FROM cron.job
  WHERE jobname = 'process-growth-emails'
  LIMIT 1;

  IF legacy_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(legacy_job_id);
  END IF;
END $$;