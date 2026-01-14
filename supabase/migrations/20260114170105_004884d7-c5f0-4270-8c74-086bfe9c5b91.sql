-- Add column to allow users to hide the daily growth brief from their dashboard
ALTER TABLE public.profiles 
ADD COLUMN hide_daily_brief boolean NOT NULL DEFAULT false;