-- Add unique constraint to personal_goals profile_id
-- This allows upsert operations to work correctly
ALTER TABLE public.personal_goals 
ADD CONSTRAINT personal_goals_profile_id_key UNIQUE (profile_id);