
-- 1) Remove existing duplicates so we can enforce uniqueness
WITH ranked AS (
  SELECT
    id,
    parsed_data->>'email_id' AS email_id,
    row_number() OVER (
      PARTITION BY parsed_data->>'email_id'
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.email_reply_logs
  WHERE (parsed_data ? 'email_id')
    AND parsed_data->>'email_id' IS NOT NULL
)
DELETE FROM public.email_reply_logs e
USING ranked r
WHERE e.id = r.id
  AND r.rn > 1;

-- 2) Add dedicated idempotency columns
ALTER TABLE public.email_reply_logs
  ADD COLUMN IF NOT EXISTS email_id text,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

-- 3) Backfill email_id from parsed_data
UPDATE public.email_reply_logs
SET email_id = COALESCE(email_id, parsed_data->>'email_id')
WHERE email_id IS NULL
  AND (parsed_data ? 'email_id')
  AND parsed_data->>'email_id' IS NOT NULL;

-- 4) Enforce uniqueness (partial unique indexes)
CREATE UNIQUE INDEX IF NOT EXISTS email_reply_logs_email_id_uniq
  ON public.email_reply_logs (email_id)
  WHERE email_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS email_reply_logs_idempotency_key_uniq
  ON public.email_reply_logs (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
