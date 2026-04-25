
CREATE TABLE public.sales_call_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sales_rep_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  org_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.sales_companies(id) ON DELETE SET NULL,
  crop_context TEXT,
  region TEXT,
  call_date DATE,
  transcript TEXT NOT NULL,
  notes TEXT,
  ai_output JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sales_call_analyses_user ON public.sales_call_analyses(user_id);
CREATE INDEX idx_sales_call_analyses_rep ON public.sales_call_analyses(sales_rep_id);
CREATE INDEX idx_sales_call_analyses_org ON public.sales_call_analyses(org_id);
CREATE INDEX idx_sales_call_analyses_created_at ON public.sales_call_analyses(created_at DESC);

ALTER TABLE public.sales_call_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own or their team's analyses"
ON public.sales_call_analyses
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR auth.uid() = sales_rep_id
  OR public.is_super_admin(auth.uid())
  OR (org_id IS NOT NULL AND org_id = public.get_user_company_id(auth.uid()))
);

CREATE POLICY "Users can create analyses for themselves or their reps"
ON public.sales_call_analyses
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
);

CREATE POLICY "Users can update their own analyses"
ON public.sales_call_analyses
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own analyses"
ON public.sales_call_analyses
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
