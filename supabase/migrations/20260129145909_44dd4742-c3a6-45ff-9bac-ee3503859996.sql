-- Add settings JSONB column to companies table for feature gating
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';

-- Enable field maps for Stateline and Streamline Ag
UPDATE companies 
SET settings = jsonb_set(COALESCE(settings, '{}'), '{enable_field_maps}', 'true')
WHERE id IN (
  'd32f9a18-aba5-4836-aa66-1834b8cb8edd', -- Stateline
  'd23e3007-254d-429a-a7e2-329bc1bf2afb'  -- Streamline Ag
);