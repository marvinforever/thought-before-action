-- Create academy_articles table for all content
CREATE TABLE public.academy_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  summary TEXT,
  content TEXT,
  content_type TEXT NOT NULL DEFAULT 'original' CHECK (content_type IN ('original', 'curated', 'aggregated')),
  source_url TEXT,
  source_name TEXT,
  source_author TEXT,
  thumbnail_url TEXT,
  reading_time_minutes INTEGER,
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create academy_article_domains for linking articles to capability domains
CREATE TABLE public.academy_article_domains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id UUID NOT NULL REFERENCES public.academy_articles(id) ON DELETE CASCADE,
  domain_id UUID NOT NULL REFERENCES public.capability_domains(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(article_id, domain_id)
);

-- Create academy_sources for RSS feeds and external sources
CREATE TABLE public.academy_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'rss' CHECK (source_type IN ('rss', 'api', 'manual')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_fetched_at TIMESTAMP WITH TIME ZONE,
  fetch_frequency_hours INTEGER DEFAULT 24,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.academy_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_article_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_sources ENABLE ROW LEVEL SECURITY;

-- Public can view published articles
CREATE POLICY "Anyone can view published articles"
ON public.academy_articles
FOR SELECT
USING (is_published = true);

-- Super admins can manage all articles
CREATE POLICY "Super admins can manage articles"
ON public.academy_articles
FOR ALL
USING (is_super_admin(auth.uid()));

-- Public can view article domains for published articles
CREATE POLICY "Anyone can view domains for published articles"
ON public.academy_article_domains
FOR SELECT
USING (article_id IN (SELECT id FROM public.academy_articles WHERE is_published = true));

-- Super admins can manage article domains
CREATE POLICY "Super admins can manage article domains"
ON public.academy_article_domains
FOR ALL
USING (is_super_admin(auth.uid()));

-- Super admins can manage sources
CREATE POLICY "Super admins can manage sources"
ON public.academy_sources
FOR ALL
USING (is_super_admin(auth.uid()));

-- Create indexes for performance
CREATE INDEX idx_academy_articles_slug ON public.academy_articles(slug);
CREATE INDEX idx_academy_articles_published ON public.academy_articles(is_published, published_at DESC);
CREATE INDEX idx_academy_articles_content_type ON public.academy_articles(content_type);
CREATE INDEX idx_academy_article_domains_article ON public.academy_article_domains(article_id);
CREATE INDEX idx_academy_article_domains_domain ON public.academy_article_domains(domain_id);

-- Trigger for updated_at
CREATE TRIGGER update_academy_articles_updated_at
BEFORE UPDATE ON public.academy_articles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_academy_sources_updated_at
BEFORE UPDATE ON public.academy_sources
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();