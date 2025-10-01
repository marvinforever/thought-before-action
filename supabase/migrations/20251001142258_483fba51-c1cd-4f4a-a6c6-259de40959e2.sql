-- Create a new temporary enum type with correct values
CREATE TYPE capability_level_new AS ENUM ('foundational', 'advancing', 'independent', 'mastery');

-- Drop defaults before altering column types
ALTER TABLE capabilities ALTER COLUMN level DROP DEFAULT;
ALTER TABLE employee_capabilities ALTER COLUMN current_level DROP DEFAULT;
ALTER TABLE employee_capabilities ALTER COLUMN target_level DROP DEFAULT;
ALTER TABLE resources ALTER COLUMN capability_level DROP DEFAULT;

-- Alter employee_capabilities columns to use new type with data conversion
ALTER TABLE employee_capabilities 
  ALTER COLUMN current_level TYPE capability_level_new 
  USING (
    CASE current_level::text
      WHEN 'beginner' THEN 'foundational'
      WHEN 'intermediate' THEN 'advancing'
      WHEN 'advanced' THEN 'independent'
      WHEN 'expert' THEN 'mastery'
      ELSE current_level::text
    END::capability_level_new
  );

ALTER TABLE employee_capabilities 
  ALTER COLUMN target_level TYPE capability_level_new 
  USING (
    CASE target_level::text
      WHEN 'beginner' THEN 'foundational'
      WHEN 'intermediate' THEN 'advancing'
      WHEN 'advanced' THEN 'independent'
      WHEN 'expert' THEN 'mastery'
      ELSE target_level::text
    END::capability_level_new
  );

-- Alter capabilities table level column
ALTER TABLE capabilities 
  ALTER COLUMN level TYPE capability_level_new 
  USING (
    CASE level::text
      WHEN 'beginner' THEN 'foundational'
      WHEN 'intermediate' THEN 'advancing'
      WHEN 'advanced' THEN 'independent'
      WHEN 'expert' THEN 'mastery'
      ELSE level::text
    END::capability_level_new
  );

-- Alter resources table capability_level column
ALTER TABLE resources 
  ALTER COLUMN capability_level TYPE capability_level_new 
  USING (
    CASE capability_level::text
      WHEN 'beginner' THEN 'foundational'
      WHEN 'intermediate' THEN 'advancing'
      WHEN 'advanced' THEN 'independent'
      WHEN 'expert' THEN 'mastery'
      ELSE capability_level::text
    END::capability_level_new
  );

-- Drop old enum and rename new one
DROP TYPE capability_level;
ALTER TYPE capability_level_new RENAME TO capability_level;

-- Re-add defaults with new enum values
ALTER TABLE capabilities ALTER COLUMN level SET DEFAULT 'foundational'::capability_level;