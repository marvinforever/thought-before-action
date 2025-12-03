-- Create knowledge sources table for storing transcripts and source content
CREATE TABLE public.knowledge_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  source_url TEXT,
  source_type TEXT NOT NULL DEFAULT 'transcript', -- transcript, notes, course, document
  source_platform TEXT, -- YouTube, Spotify, manual, etc.
  author TEXT,
  transcript TEXT NOT NULL,
  word_count INTEGER,
  duration_minutes INTEGER,
  tags TEXT[] DEFAULT '{}',
  domain_ids UUID[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.knowledge_sources ENABLE ROW LEVEL SECURITY;

-- Only super admins can manage knowledge sources (internal library)
CREATE POLICY "Super admins can manage knowledge sources"
ON public.knowledge_sources
FOR ALL
USING (is_super_admin(auth.uid()));

-- Create index for searching
CREATE INDEX idx_knowledge_sources_source_type ON public.knowledge_sources(source_type);
CREATE INDEX idx_knowledge_sources_tags ON public.knowledge_sources USING GIN(tags);
CREATE INDEX idx_knowledge_sources_domain_ids ON public.knowledge_sources USING GIN(domain_ids);

-- Full text search index
CREATE INDEX idx_knowledge_sources_transcript_search ON public.knowledge_sources 
USING GIN(to_tsvector('english', transcript));

-- Add trigger for updated_at
CREATE TRIGGER update_knowledge_sources_updated_at
  BEFORE UPDATE ON public.knowledge_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();