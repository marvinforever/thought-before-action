-- Extend diagnostic_responses table with missing fields
ALTER TABLE public.diagnostic_responses
ADD COLUMN IF NOT EXISTS department_or_team text,
ADD COLUMN IF NOT EXISTS job_title_or_role text,
ADD COLUMN IF NOT EXISTS years_with_company text,
ADD COLUMN IF NOT EXISTS years_in_current_role text,
ADD COLUMN IF NOT EXISTS employment_status text,
ADD COLUMN IF NOT EXISTS manages_others boolean,
ADD COLUMN IF NOT EXISTS company_size text,
ADD COLUMN IF NOT EXISTS leadership_application_frequency text,
ADD COLUMN IF NOT EXISTS communication_application_frequency text,
ADD COLUMN IF NOT EXISTS technical_application_frequency text,
ADD COLUMN IF NOT EXISTS strategic_thinking_application_frequency text,
ADD COLUMN IF NOT EXISTS adaptability_application_frequency text,
ADD COLUMN IF NOT EXISTS work_life_integration_score integer,
ADD COLUMN IF NOT EXISTS typeform_response_id text,
ADD COLUMN IF NOT EXISTS typeform_start_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS typeform_submit_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS survey_version text DEFAULT '1.0',
ADD COLUMN IF NOT EXISTS additional_responses jsonb DEFAULT '{}'::jsonb;

-- Create index on typeform_response_id for quick lookups
CREATE INDEX IF NOT EXISTS idx_diagnostic_responses_typeform_id ON public.diagnostic_responses(typeform_response_id);

-- Create index on survey_version for filtering
CREATE INDEX IF NOT EXISTS idx_diagnostic_responses_survey_version ON public.diagnostic_responses(survey_version);