
CREATE TABLE public.sales_email_forwards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_reply_log_id UUID REFERENCES public.email_reply_logs(id) ON DELETE SET NULL,
  profile_id UUID NOT NULL,
  company_id UUID,
  sender_email TEXT NOT NULL,
  email_subject TEXT,
  raw_body TEXT,
  classified_intent TEXT NOT NULL CHECK (classified_intent IN ('forward', 'query', 'note', 'reflect', 'unknown')),
  intent_confidence NUMERIC(3,2) DEFAULT 0.5,
  extracted_entities JSONB DEFAULT '{}'::jsonb,
  actions_performed JSONB DEFAULT '[]'::jsonb,
  reply_sent TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed', 'rejected', 'awaiting_confirmation')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_sales_email_forwards_profile ON public.sales_email_forwards(profile_id, created_at DESC);
CREATE INDEX idx_sales_email_forwards_intent ON public.sales_email_forwards(classified_intent, status);

ALTER TABLE public.sales_email_forwards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own sales email forwards"
  ON public.sales_email_forwards
  FOR SELECT
  USING (profile_id = auth.uid() OR public.is_super_admin(auth.uid()));

-- No INSERT/UPDATE/DELETE policies — only service role writes.
