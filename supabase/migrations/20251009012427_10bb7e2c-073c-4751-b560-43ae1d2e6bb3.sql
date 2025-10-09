-- Add budget scenario cost columns to training_cohorts table
ALTER TABLE training_cohorts
ADD COLUMN IF NOT EXISTS estimated_cost_conservative numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS estimated_cost_moderate numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS estimated_cost_aggressive numeric DEFAULT 0;