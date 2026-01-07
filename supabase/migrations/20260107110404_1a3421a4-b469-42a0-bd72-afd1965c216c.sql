-- Fix ON CONFLICT target: supabase-js upsert cannot reference partial unique indexes.
-- Create NON-partial unique indexes (multiple NULLs are allowed in Postgres unique indexes).

DROP INDEX IF EXISTS public.email_reply_logs_idempotency_key_uniq;
DROP INDEX IF EXISTS public.email_reply_logs_email_id_uniq;

CREATE UNIQUE INDEX IF NOT EXISTS email_reply_logs_idempotency_key_uniq
  ON public.email_reply_logs (idempotency_key);

CREATE UNIQUE INDEX IF NOT EXISTS email_reply_logs_email_id_uniq
  ON public.email_reply_logs (email_id);