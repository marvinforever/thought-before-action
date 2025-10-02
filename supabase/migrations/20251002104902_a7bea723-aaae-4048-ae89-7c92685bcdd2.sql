-- Create conversations table to track chat sessions with Jericho
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT,
  context_snapshot JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create conversation_messages table to store individual messages
CREATE TABLE public.conversation_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversations
CREATE POLICY "Users can view their own conversations"
ON public.conversations
FOR SELECT
USING (profile_id = auth.uid());

CREATE POLICY "Users can insert their own conversations"
ON public.conversations
FOR INSERT
WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update their own conversations"
ON public.conversations
FOR UPDATE
USING (profile_id = auth.uid());

CREATE POLICY "Admins can view conversations in their company"
ON public.conversations
FOR SELECT
USING (company_id IN (
  SELECT company_id FROM public.profiles 
  WHERE id = auth.uid() AND is_admin = true
));

-- RLS Policies for conversation_messages
CREATE POLICY "Users can view messages in their conversations"
ON public.conversation_messages
FOR SELECT
USING (conversation_id IN (
  SELECT id FROM public.conversations WHERE profile_id = auth.uid()
));

CREATE POLICY "Users can insert messages in their conversations"
ON public.conversation_messages
FOR INSERT
WITH CHECK (conversation_id IN (
  SELECT id FROM public.conversations WHERE profile_id = auth.uid()
));

-- Create trigger for updating conversations.updated_at
CREATE TRIGGER update_conversations_updated_at
BEFORE UPDATE ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better query performance
CREATE INDEX idx_conversations_profile_id ON public.conversations(profile_id);
CREATE INDEX idx_conversation_messages_conversation_id ON public.conversation_messages(conversation_id);
CREATE INDEX idx_conversation_messages_created_at ON public.conversation_messages(created_at);