-- Create call_plan_reminders table to track sent reminder emails
CREATE TABLE public.call_plan_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  call_plan_tracking_id UUID REFERENCES public.call_plan_tracking(id) ON DELETE CASCADE NOT NULL,
  call_number INTEGER NOT NULL CHECK (call_number BETWEEN 1 AND 4),
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('7_day', '1_day')),
  customer_name TEXT NOT NULL,
  meeting_date DATE NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  subject TEXT,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Prevent duplicate reminders
  UNIQUE(call_plan_tracking_id, call_number, reminder_type)
);

-- Enable Row Level Security
ALTER TABLE public.call_plan_reminders ENABLE ROW LEVEL SECURITY;

-- RLS: users can view their own reminders
CREATE POLICY "Users can view their own reminders"
ON public.call_plan_reminders
FOR SELECT USING (profile_id = auth.uid());

-- RLS: service role can insert (for edge functions)
CREATE POLICY "Service role can insert reminders"
ON public.call_plan_reminders
FOR INSERT WITH CHECK (true);

-- Add indexes for efficient querying
CREATE INDEX idx_call_plan_reminders_profile_id ON public.call_plan_reminders(profile_id);
CREATE INDEX idx_call_plan_reminders_tracking_id ON public.call_plan_reminders(call_plan_tracking_id);
CREATE INDEX idx_call_plan_reminders_meeting_date ON public.call_plan_reminders(meeting_date);