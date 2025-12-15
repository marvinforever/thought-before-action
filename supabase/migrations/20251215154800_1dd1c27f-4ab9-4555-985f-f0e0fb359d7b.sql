-- Add habit_type to leading_indicators (habits) to distinguish personal vs professional
ALTER TABLE public.leading_indicators
ADD COLUMN habit_type text NOT NULL DEFAULT 'professional';

-- Add goal_type to ninety_day_targets to distinguish personal vs professional 90-day outcomes
ALTER TABLE public.ninety_day_targets
ADD COLUMN goal_type text NOT NULL DEFAULT 'professional';

-- Add comments explaining the legal significance
COMMENT ON COLUMN public.leading_indicators.habit_type IS 'personal or professional - personal habits cannot be used in performance reviews by law';
COMMENT ON COLUMN public.ninety_day_targets.goal_type IS 'personal or professional - personal goals cannot be used in performance reviews by law';