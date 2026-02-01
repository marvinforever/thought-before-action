-- Store Backboard thread mappings for persistent memory
CREATE TABLE IF NOT EXISTS public.backboard_threads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assistant_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  context_type TEXT DEFAULT 'general', -- 'general', 'sales', 'career', etc.
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(profile_id, context_type)
);

-- Enable RLS
ALTER TABLE public.backboard_threads ENABLE ROW LEVEL SECURITY;

-- Users can view their own threads
CREATE POLICY "Users can view their own backboard threads"
ON public.backboard_threads
FOR SELECT
USING (auth.uid() = profile_id);

-- Users can insert their own threads
CREATE POLICY "Users can insert their own backboard threads"
ON public.backboard_threads
FOR INSERT
WITH CHECK (auth.uid() = profile_id);

-- Users can update their own threads
CREATE POLICY "Users can update their own backboard threads"
ON public.backboard_threads
FOR UPDATE
USING (auth.uid() = profile_id);

-- Add updated_at trigger
CREATE TRIGGER update_backboard_threads_updated_at
BEFORE UPDATE ON public.backboard_threads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();