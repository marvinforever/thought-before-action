-- Add full_description column to capabilities table
ALTER TABLE public.capabilities
ADD COLUMN IF NOT EXISTS full_description TEXT;

-- Create capability_levels table to store the four progression levels
CREATE TABLE IF NOT EXISTS public.capability_levels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  capability_id UUID NOT NULL REFERENCES public.capabilities(id) ON DELETE CASCADE,
  level TEXT NOT NULL CHECK (level IN ('foundational', 'advancing', 'independent', 'mastery')),
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(capability_id, level)
);

-- Enable RLS on capability_levels
ALTER TABLE public.capability_levels ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to view capability levels
CREATE POLICY "Anyone can view capability levels"
ON public.capability_levels
FOR SELECT
USING (true);