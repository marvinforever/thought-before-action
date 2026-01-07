-- Create table for Resend's direct Supabase integration
-- Resend will write directly to this table when emails arrive

CREATE TABLE IF NOT EXISTS public.resend_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id TEXT NOT NULL UNIQUE,
  from_email TEXT NOT NULL,
  to_email TEXT,
  subject TEXT,
  text TEXT,
  html TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Allow Resend to insert (they use service role key)
ALTER TABLE public.resend_emails ENABLE ROW LEVEL SECURITY;

-- Policy for service role to insert/read
CREATE POLICY "Service role full access" ON public.resend_emails
  FOR ALL USING (true) WITH CHECK (true);

-- Index for looking up unprocessed emails
CREATE INDEX idx_resend_emails_unprocessed ON public.resend_emails (created_at) 
  WHERE processed_at IS NULL;