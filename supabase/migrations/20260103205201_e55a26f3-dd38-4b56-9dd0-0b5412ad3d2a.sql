-- Add has_seen_manager_onboarding column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS has_seen_manager_onboarding boolean DEFAULT false;