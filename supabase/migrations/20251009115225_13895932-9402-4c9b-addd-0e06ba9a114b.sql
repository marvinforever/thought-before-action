-- Add self-assessment fields to employee_capabilities table
ALTER TABLE public.employee_capabilities
ADD COLUMN IF NOT EXISTS self_assessed_level text,
ADD COLUMN IF NOT EXISTS self_assessed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS self_assessment_notes text,
ADD COLUMN IF NOT EXISTS manager_assessed_at timestamp with time zone;

-- Add index for faster queries on self-assessment status
CREATE INDEX IF NOT EXISTS idx_employee_capabilities_self_assessed 
ON public.employee_capabilities(profile_id, self_assessed_at);