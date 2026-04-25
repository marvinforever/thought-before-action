CREATE TABLE public.sales_market_trends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id UUID NOT NULL REFERENCES public.sales_call_analyses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sales_rep_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  org_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.sales_companies(id) ON DELETE SET NULL,
  crop_context TEXT,
  region TEXT,
  call_date DATE,
  trend_type TEXT NOT NULL,
  trend_label TEXT NOT NULL,
  evidence TEXT,
  confidence INTEGER CHECK (confidence BETWEEN 1 AND 10),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_sales_market_trends_analysis ON public.sales_market_trends(analysis_id);
CREATE INDEX idx_sales_market_trends_org ON public.sales_market_trends(org_id);
CREATE INDEX idx_sales_market_trends_rep ON public.sales_market_trends(sales_rep_id);
CREATE INDEX idx_sales_market_trends_type ON public.sales_market_trends(trend_type);
CREATE INDEX idx_sales_market_trends_created_at ON public.sales_market_trends(created_at DESC);

ALTER TABLE public.sales_market_trends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view trends in their scope"
ON public.sales_market_trends
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR auth.uid() = sales_rep_id
  OR is_super_admin(auth.uid())
  OR (org_id IS NOT NULL AND org_id = get_user_company_id(auth.uid()))
);

CREATE POLICY "Users can create trends for their analyses"
ON public.sales_market_trends
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trends"
ON public.sales_market_trends
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trends"
ON public.sales_market_trends
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);