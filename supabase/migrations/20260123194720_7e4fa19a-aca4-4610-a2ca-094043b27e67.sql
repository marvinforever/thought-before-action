-- Phase 1 & 4: Add file columns to sales_knowledge + Create feedback/learning tables

-- Add file storage columns to sales_knowledge table
ALTER TABLE public.sales_knowledge
ADD COLUMN IF NOT EXISTS file_url TEXT,
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS file_type TEXT;

-- Create sales_coach_feedback table for thumbs up/down ratings
CREATE TABLE public.sales_coach_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.sales_coach_messages(id) ON DELETE CASCADE,
  recommendation_type TEXT, -- 'product_rec', 'objection_handling', 'call_script', 'discovery', 'general'
  rating TEXT NOT NULL CHECK (rating IN ('up', 'down')),
  feedback_text TEXT, -- Optional explanation for downvotes
  context_snapshot JSONB, -- Store conversation context at time of feedback
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create sales_coach_learning table for aggregated company patterns
CREATE TABLE public.sales_coach_learning (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  pattern_type TEXT NOT NULL, -- 'preferred_approach', 'avoid', 'terminology', 'product_knowledge'
  pattern_key TEXT NOT NULL, -- e.g., 'objection:price', 'product:viking-73-97'
  learned_response TEXT NOT NULL,
  confidence_score NUMERIC DEFAULT 0.5,
  feedback_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, pattern_type, pattern_key)
);

-- Create customer_insights table for auto-extracted signals
CREATE TABLE public.customer_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.sales_companies(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL, -- 'buying_signal', 'objection', 'preference', 'opportunity', 'competitor'
  insight_text TEXT NOT NULL,
  source_message_id UUID REFERENCES public.sales_coach_messages(id) ON DELETE SET NULL,
  products_mentioned TEXT[],
  confidence NUMERIC DEFAULT 0.5,
  is_actionable BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.sales_coach_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_coach_learning ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_insights ENABLE ROW LEVEL SECURITY;

-- RLS policies for sales_coach_feedback
CREATE POLICY "Users can view their company's feedback" 
ON public.sales_coach_feedback FOR SELECT 
USING (
  company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
);

CREATE POLICY "Users can insert their own feedback" 
ON public.sales_coach_feedback FOR INSERT 
WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can delete their own feedback" 
ON public.sales_coach_feedback FOR DELETE 
USING (profile_id = auth.uid());

-- RLS policies for sales_coach_learning
CREATE POLICY "Users can view their company's learnings" 
ON public.sales_coach_learning FOR SELECT 
USING (
  company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
);

CREATE POLICY "Super admins can manage learnings" 
ON public.sales_coach_learning FOR ALL 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true));

-- RLS policies for customer_insights
CREATE POLICY "Users can view their company's insights" 
ON public.customer_insights FOR SELECT 
USING (
  company_id IN (SELECT company_id FROM public.sales_companies WHERE profile_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
);

CREATE POLICY "Users can insert insights for their companies" 
ON public.customer_insights FOR INSERT 
WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update their own insights" 
ON public.customer_insights FOR UPDATE 
USING (profile_id = auth.uid());

-- Update trigger for sales_coach_learning
CREATE TRIGGER update_sales_coach_learning_updated_at
BEFORE UPDATE ON public.sales_coach_learning
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();