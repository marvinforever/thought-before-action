-- Add personal vision columns to personal_goals table
ALTER TABLE public.personal_goals 
ADD COLUMN IF NOT EXISTS personal_one_year_vision TEXT,
ADD COLUMN IF NOT EXISTS personal_three_year_vision TEXT;

-- Rename existing columns to be explicitly professional (optional comment for clarity)
COMMENT ON COLUMN public.personal_goals.one_year_vision IS 'Professional 1-year vision';
COMMENT ON COLUMN public.personal_goals.three_year_vision IS 'Professional 3-year vision';
COMMENT ON COLUMN public.personal_goals.personal_one_year_vision IS 'Personal 1-year vision';
COMMENT ON COLUMN public.personal_goals.personal_three_year_vision IS 'Personal 3-year vision';