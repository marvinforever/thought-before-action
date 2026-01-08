-- Add company_id to sales_knowledge for company-specific methodologies
ALTER TABLE public.sales_knowledge 
ADD COLUMN company_id uuid REFERENCES public.companies(id);

-- Create index for faster company lookups
CREATE INDEX idx_sales_knowledge_company ON public.sales_knowledge(company_id);

COMMENT ON COLUMN public.sales_knowledge.company_id IS 'Optional company ID to restrict methodology to specific companies';