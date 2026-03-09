
ALTER TABLE public.sales_contacts 
ADD COLUMN IF NOT EXISTS pipeline_stage text NOT NULL DEFAULT 'prospect',
ADD COLUMN IF NOT EXISTS last_purchase_date date;
