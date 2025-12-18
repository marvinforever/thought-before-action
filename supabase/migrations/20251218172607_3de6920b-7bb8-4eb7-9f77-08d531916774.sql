-- =============================================
-- PHASE 0.2: SMS/Voice Opt-In Infrastructure
-- =============================================

-- Add SMS/Voice opt-in fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sms_opted_in BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_opted_in_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS voice_opted_in BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS voice_opted_in_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';

-- =============================================
-- PHASE 1.1: SMS Messages Table
-- =============================================

-- Create sms_messages table for logging all SMS traffic
CREATE TABLE public.sms_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  phone_number TEXT NOT NULL,
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'general',
  twilio_sid TEXT,
  status TEXT DEFAULT 'pending',
  parsed_intent TEXT,
  parsed_data JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Create index for efficient lookups
CREATE INDEX idx_sms_messages_profile_id ON public.sms_messages(profile_id);
CREATE INDEX idx_sms_messages_phone_number ON public.sms_messages(phone_number);
CREATE INDEX idx_sms_messages_created_at ON public.sms_messages(created_at DESC);

-- Enable RLS
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;

-- Users can view their own SMS messages
CREATE POLICY "Users can view their own SMS messages"
ON public.sms_messages FOR SELECT
TO authenticated
USING (profile_id = auth.uid());

-- Super admins can view all SMS messages
CREATE POLICY "Super admins can view all SMS messages"
ON public.sms_messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
  )
);

-- Company admins can view their company's SMS messages
CREATE POLICY "Company admins can view company SMS messages"
ON public.sms_messages FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT p.company_id FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.id = auth.uid() AND ur.role IN ('admin', 'super_admin')
  )
);

-- Service role can insert/update (for edge functions)
CREATE POLICY "Service can manage SMS messages"
ON public.sms_messages FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
  )
);