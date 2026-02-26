
-- Phase 5: Telegram outreach tables

CREATE TABLE public.telegram_outreach_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  proactive_enabled boolean NOT NULL DEFAULT true,
  max_daily_messages integer NOT NULL DEFAULT 3,
  paused_until timestamptz,
  quiet_hours_start time NOT NULL DEFAULT '20:00',
  quiet_hours_end time NOT NULL DEFAULT '07:00',
  last_engagement_at timestamptz,
  consecutive_ignored integer NOT NULL DEFAULT 0,
  preferred_response_format text NOT NULL DEFAULT 'text',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_outreach_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own prefs"
  ON public.telegram_outreach_preferences
  FOR ALL
  USING (auth.uid() = user_id);

CREATE TABLE public.telegram_outreach_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trigger_type text NOT NULL,
  message_text text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  was_engaged boolean DEFAULT false
);

CREATE INDEX idx_outreach_log_user_sent ON public.telegram_outreach_log(user_id, sent_at DESC);

ALTER TABLE public.telegram_outreach_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own outreach"
  ON public.telegram_outreach_log
  FOR SELECT
  USING (auth.uid() = user_id);
