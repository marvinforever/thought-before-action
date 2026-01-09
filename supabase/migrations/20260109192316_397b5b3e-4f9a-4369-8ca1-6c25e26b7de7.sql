-- Create sales coach conversations table
CREATE TABLE public.sales_coach_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sales coach messages table
CREATE TABLE public.sales_coach_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.sales_coach_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sales_coach_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_coach_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for conversations
CREATE POLICY "Users can view their own sales coach conversations"
ON public.sales_coach_conversations FOR SELECT
USING (auth.uid() = profile_id);

CREATE POLICY "Users can create their own sales coach conversations"
ON public.sales_coach_conversations FOR INSERT
WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can update their own sales coach conversations"
ON public.sales_coach_conversations FOR UPDATE
USING (auth.uid() = profile_id);

CREATE POLICY "Users can delete their own sales coach conversations"
ON public.sales_coach_conversations FOR DELETE
USING (auth.uid() = profile_id);

-- RLS policies for messages (via conversation ownership)
CREATE POLICY "Users can view messages from their conversations"
ON public.sales_coach_messages FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.sales_coach_conversations
  WHERE id = conversation_id AND profile_id = auth.uid()
));

CREATE POLICY "Users can create messages in their conversations"
ON public.sales_coach_messages FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.sales_coach_conversations
  WHERE id = conversation_id AND profile_id = auth.uid()
));

-- Indexes for performance
CREATE INDEX idx_sales_coach_conversations_profile ON public.sales_coach_conversations(profile_id);
CREATE INDEX idx_sales_coach_messages_conversation ON public.sales_coach_messages(conversation_id);
CREATE INDEX idx_sales_coach_messages_created ON public.sales_coach_messages(created_at);

-- Trigger for updated_at
CREATE TRIGGER update_sales_coach_conversations_updated_at
BEFORE UPDATE ON public.sales_coach_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();