
-- Add industry column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS industry text DEFAULT null;

-- Add goal lifecycle fields to ninety_day_targets
ALTER TABLE ninety_day_targets 
  ADD COLUMN IF NOT EXISTS goal_status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS goal_cycle text,
  ADD COLUMN IF NOT EXISTS goal_set_at timestamptz,
  ADD COLUMN IF NOT EXISTS goal_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS goal_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_roll_enabled boolean DEFAULT true;
