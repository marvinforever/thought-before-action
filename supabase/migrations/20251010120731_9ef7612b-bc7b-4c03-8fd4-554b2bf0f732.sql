-- Add missing columns to strategic_learning_reports table
ALTER TABLE public.strategic_learning_reports 
ADD COLUMN IF NOT EXISTS cohorts JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.strategic_learning_reports 
ADD COLUMN IF NOT EXISTS narrative TEXT;

-- Remove columns that aren't being used
ALTER TABLE public.strategic_learning_reports 
DROP COLUMN IF EXISTS timeframe_years,
DROP COLUMN IF EXISTS total_employees,
DROP COLUMN IF EXISTS total_cohorts,
DROP COLUMN IF EXISTS generated_by;
