-- Create table to persist deal-specific coaching conversations
CREATE TABLE public.deal_coaching_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.sales_deals(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookup by deal
CREATE INDEX idx_deal_coaching_messages_deal_id ON public.deal_coaching_messages(deal_id);
CREATE INDEX idx_deal_coaching_messages_profile_id ON public.deal_coaching_messages(profile_id);

-- Enable RLS
ALTER TABLE public.deal_coaching_messages ENABLE ROW LEVEL SECURITY;

-- Users can read their own coaching messages
CREATE POLICY "Users can read own deal coaching messages"
  ON public.deal_coaching_messages
  FOR SELECT
  USING (profile_id = auth.uid());

-- Users can insert their own coaching messages
CREATE POLICY "Users can insert own deal coaching messages"
  ON public.deal_coaching_messages
  FOR INSERT
  WITH CHECK (profile_id = auth.uid());

-- Enable realtime for immediate updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.deal_coaching_messages;