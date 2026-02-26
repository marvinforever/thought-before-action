
-- ============================================================================
-- TELEGRAM INTEGRATION: 4 tables + RLS + indexes
-- ============================================================================

-- 1. telegram_links: Maps Telegram chat IDs to Jericho users
CREATE TABLE public.telegram_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_chat_id BIGINT NOT NULL UNIQUE,
  telegram_username TEXT,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE public.telegram_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own telegram link"
  ON public.telegram_links FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own telegram link"
  ON public.telegram_links FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert telegram links"
  ON public.telegram_links FOR INSERT
  WITH CHECK (true);

-- 2. telegram_link_codes: One-time codes for account linking
CREATE TABLE public.telegram_link_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_link_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own link codes"
  ON public.telegram_link_codes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own link codes"
  ON public.telegram_link_codes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_telegram_link_codes_active ON public.telegram_link_codes (code) WHERE used_at IS NULL;

-- 3. telegram_conversations: Full message log
CREATE TABLE public.telegram_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_chat_id BIGINT NOT NULL,
  message_text TEXT NOT NULL,
  response_text TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own telegram conversations"
  ON public.telegram_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert telegram conversations"
  ON public.telegram_conversations FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_telegram_conversations_user ON public.telegram_conversations (user_id, created_at DESC);
CREATE INDEX idx_telegram_conversations_chat ON public.telegram_conversations (telegram_chat_id, created_at DESC);

-- 4. telegram_scheduled_messages: Scaffold for proactive outreach
CREATE TABLE public.telegram_scheduled_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_chat_id BIGINT NOT NULL,
  message_text TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_scheduled_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own scheduled messages"
  ON public.telegram_scheduled_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX idx_telegram_scheduled_pending ON public.telegram_scheduled_messages (status, scheduled_for) WHERE status = 'pending';
