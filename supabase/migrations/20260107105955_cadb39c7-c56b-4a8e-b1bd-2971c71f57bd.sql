-- Ensure email_reply_logs has idempotency fields and uniqueness for safe upserts

ALTER TABLE public.email_reply_logs
  ADD COLUMN IF NOT EXISTS email_id text,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

-- Backfill email_id for existing rows (best-effort)
UPDATE public.email_reply_logs
SET email_id = COALESCE(email_id, parsed_data->>'email_id')
WHERE email_id IS NULL AND parsed_data ? 'email_id';

-- Backfill idempotency_key for existing rows (best-effort)
UPDATE public.email_reply_logs
SET idempotency_key = COALESCE(idempotency_key, email_id)
WHERE idempotency_key IS NULL AND email_id IS NOT NULL;

-- De-dupe existing rows so unique indexes can be created
-- Keep the newest row per email_id
DELETE FROM public.email_reply_logs a
USING public.email_reply_logs b
WHERE a.email_id IS NOT NULL
  AND b.email_id IS NOT NULL
  AND a.email_id = b.email_id
  AND a.created_at < b.created_at;

-- Keep the newest row per idempotency_key
DELETE FROM public.email_reply_logs a
USING public.email_reply_logs b
WHERE a.idempotency_key IS NOT NULL
  AND b.idempotency_key IS NOT NULL
  AND a.idempotency_key = b.idempotency_key
  AND a.created_at < b.created_at;

-- Unique indexes required for ON CONFLICT
CREATE UNIQUE INDEX IF NOT EXISTS email_reply_logs_email_id_uniq
  ON public.email_reply_logs (email_id)
  WHERE email_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS email_reply_logs_idempotency_key_uniq
  ON public.email_reply_logs (idempotency_key)
  WHERE idempotency_key IS NOT NULL;