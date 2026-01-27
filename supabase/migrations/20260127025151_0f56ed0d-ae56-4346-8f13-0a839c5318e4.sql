-- Create call_plan_tracking table for 4-Call Plan feature
CREATE TABLE public.call_plan_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  customer_id uuid REFERENCES public.sales_companies(id) ON DELETE SET NULL,
  plan_year integer NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  total_revenue numeric DEFAULT 0,
  acreage integer,
  crops text,
  call_1_completed boolean DEFAULT false,
  call_1_date date,
  call_1_notes text,
  call_2_completed boolean DEFAULT false,
  call_2_date date,
  call_2_notes text,
  call_3_completed boolean DEFAULT false,
  call_3_date date,
  call_3_notes text,
  call_4_completed boolean DEFAULT false,
  call_4_date date,
  call_4_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(profile_id, customer_name, plan_year)
);

-- Enable RLS
ALTER TABLE public.call_plan_tracking ENABLE ROW LEVEL SECURITY;

-- Users can only view their own tracking records
CREATE POLICY "Users can view own call plan tracking"
  ON public.call_plan_tracking
  FOR SELECT
  USING (auth.uid() = profile_id);

-- Users can insert their own tracking records
CREATE POLICY "Users can insert own call plan tracking"
  ON public.call_plan_tracking
  FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

-- Users can update their own tracking records
CREATE POLICY "Users can update own call plan tracking"
  ON public.call_plan_tracking
  FOR UPDATE
  USING (auth.uid() = profile_id);

-- Users can delete their own tracking records
CREATE POLICY "Users can delete own call plan tracking"
  ON public.call_plan_tracking
  FOR DELETE
  USING (auth.uid() = profile_id);

-- Add updated_at trigger
CREATE TRIGGER update_call_plan_tracking_updated_at
  BEFORE UPDATE ON public.call_plan_tracking
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();