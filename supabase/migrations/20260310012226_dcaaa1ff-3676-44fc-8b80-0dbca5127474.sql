CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_address TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_preview TEXT,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  function_name TEXT,
  profile_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view email logs"
ON public.email_logs FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Service role can insert email logs"
ON public.email_logs FOR INSERT
TO authenticated
WITH CHECK (true);