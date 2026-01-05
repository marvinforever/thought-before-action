-- Add 'partner' to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'partner';

-- Create referral_partners table
CREATE TABLE public.referral_partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  referral_code TEXT NOT NULL UNIQUE,
  commission_rate DECIMAL(3,2) NOT NULL DEFAULT 0.10,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create referral_leads table
CREATE TABLE public.referral_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID NOT NULL REFERENCES public.referral_partners(id) ON DELETE CASCADE,
  lead_email TEXT,
  lead_company TEXT,
  status TEXT NOT NULL DEFAULT 'clicked' CHECK (status IN ('clicked', 'demo_booked', 'trial', 'converted', 'churned')),
  deal_value DECIMAL(10,2),
  converted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create referral_payouts table
CREATE TABLE public.referral_payouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID NOT NULL REFERENCES public.referral_partners(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.referral_leads(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  paid_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.referral_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_payouts ENABLE ROW LEVEL SECURITY;

-- RLS for referral_partners
-- Partners can view their own record
CREATE POLICY "Partners can view own record"
  ON public.referral_partners FOR SELECT
  USING (auth.uid() = user_id);

-- Partners can update their own record
CREATE POLICY "Partners can update own record"
  ON public.referral_partners FOR UPDATE
  USING (auth.uid() = user_id);

-- Anyone can insert (for registration)
CREATE POLICY "Anyone can register as partner"
  ON public.referral_partners FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Super admins can do everything
CREATE POLICY "Super admins full access to partners"
  ON public.referral_partners FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'));

-- RLS for referral_leads
-- Partners can view leads they referred
CREATE POLICY "Partners can view their leads"
  ON public.referral_leads FOR SELECT
  USING (
    partner_id IN (SELECT id FROM public.referral_partners WHERE user_id = auth.uid())
  );

-- Anyone can insert leads (for tracking clicks)
CREATE POLICY "Anyone can create leads"
  ON public.referral_leads FOR INSERT
  WITH CHECK (true);

-- Super admins can do everything
CREATE POLICY "Super admins full access to leads"
  ON public.referral_leads FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'));

-- RLS for referral_payouts
-- Partners can view their payouts
CREATE POLICY "Partners can view their payouts"
  ON public.referral_payouts FOR SELECT
  USING (
    partner_id IN (SELECT id FROM public.referral_partners WHERE user_id = auth.uid())
  );

-- Super admins can do everything
CREATE POLICY "Super admins full access to payouts"
  ON public.referral_payouts FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Create function to generate unique referral code
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a 6-character alphanumeric code
    new_code := upper(substr(md5(random()::text), 1, 6));
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM public.referral_partners WHERE referral_code = new_code) INTO code_exists;
    
    -- Exit loop if code is unique
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;