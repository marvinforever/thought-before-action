-- Create customer purchase history table for historical sales data
CREATE TABLE public.customer_purchase_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Customer Info
  customer_code TEXT,
  customer_name TEXT NOT NULL,
  address_1 TEXT,
  address_2 TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  phone TEXT,
  
  -- Product Info
  product_code TEXT,
  product_description TEXT,
  epa_number TEXT,
  unit_of_measure TEXT,
  
  -- Transaction Details
  sale_date DATE,
  season TEXT,
  quantity NUMERIC,
  amount NUMERIC,
  avg_price NUMERIC,
  
  -- Rep & Bonus Tracking
  rep_name TEXT,
  sort_category TEXT,
  bonus_category TEXT,
  bonus_amount NUMERIC,
  category_11_4 TEXT,
  quantity_11_4 NUMERIC,
  
  -- Metadata
  imported_at TIMESTAMPTZ DEFAULT now(),
  source_file TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_purchase_history ENABLE ROW LEVEL SECURITY;

-- RLS policies - company members can view their company's data
CREATE POLICY "Users can view their company's purchase history"
ON public.customer_purchase_history
FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- Super admins can manage all data
CREATE POLICY "Super admins can manage all purchase history"
ON public.customer_purchase_history
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND is_super_admin = true
  )
);

-- Company admins can manage their company's data
CREATE POLICY "Company admins can manage their purchase history"
ON public.customer_purchase_history
FOR ALL
USING (
  company_id IN (
    SELECT company_id FROM public.profiles 
    WHERE id = auth.uid() AND is_admin = true
  )
);

-- Indexes for common queries
CREATE INDEX idx_cph_company ON public.customer_purchase_history(company_id);
CREATE INDEX idx_cph_customer ON public.customer_purchase_history(customer_name);
CREATE INDEX idx_cph_rep ON public.customer_purchase_history(rep_name);
CREATE INDEX idx_cph_date ON public.customer_purchase_history(sale_date);
CREATE INDEX idx_cph_season ON public.customer_purchase_history(season);
CREATE INDEX idx_cph_product ON public.customer_purchase_history(product_description);