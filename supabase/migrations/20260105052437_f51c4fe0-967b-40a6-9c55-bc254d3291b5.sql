-- Add contact_name column to referral_leads
ALTER TABLE public.referral_leads ADD COLUMN IF NOT EXISTS contact_name text;