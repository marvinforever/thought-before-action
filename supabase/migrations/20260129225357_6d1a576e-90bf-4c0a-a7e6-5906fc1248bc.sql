-- Add missing columns to existing customer_insights table
ALTER TABLE public.customer_insights
ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.sales_companies(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS customer_name text,
ADD COLUMN IF NOT EXISTS source_conversation_id uuid,
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create index for customer lookups
CREATE INDEX IF NOT EXISTS idx_customer_insights_customer_id ON public.customer_insights(customer_id);

-- Relax the insight_type check constraint to allow more types
ALTER TABLE public.customer_insights DROP CONSTRAINT IF EXISTS customer_insights_insight_type_check;