-- Add new columns to sales_deals for targeted account data
ALTER TABLE public.sales_deals 
  ADD COLUMN IF NOT EXISTS estimated_acres integer,
  ADD COLUMN IF NOT EXISTS customer_type text,
  ADD COLUMN IF NOT EXISTS target_categories jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.sales_deals.estimated_acres IS 'Farm size in acres for opportunity sizing';
COMMENT ON COLUMN public.sales_deals.customer_type IS 'prospect or current_customer';
COMMENT ON COLUMN public.sales_deals.target_categories IS 'JSON with primary, secondary, tertiary growth categories';