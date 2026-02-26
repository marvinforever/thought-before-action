
-- Add telegram_update_id for duplicate prevention
ALTER TABLE public.telegram_conversations 
  ADD COLUMN IF NOT EXISTS telegram_update_id bigint;

-- Index for fast duplicate detection
CREATE INDEX IF NOT EXISTS idx_telegram_conversations_update_id 
  ON public.telegram_conversations(telegram_update_id) 
  WHERE telegram_update_id IS NOT NULL;

-- Index for fast conversation history loading
CREATE INDEX IF NOT EXISTS idx_telegram_conversations_user_created 
  ON public.telegram_conversations(user_id, created_at DESC);
