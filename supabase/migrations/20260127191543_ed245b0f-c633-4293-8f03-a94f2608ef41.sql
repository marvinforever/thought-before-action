-- Add column to store the precall plan for each customer
ALTER TABLE public.call_plan_tracking 
ADD COLUMN IF NOT EXISTS precall_plan TEXT;