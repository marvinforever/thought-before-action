-- Add columns to track AI-researched prospects
ALTER TABLE sales_companies 
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS research_citations JSONB,
  ADD COLUMN IF NOT EXISTS research_date TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN sales_companies.source IS 'How this company was added: manual, ai_research, or import';
COMMENT ON COLUMN sales_companies.research_citations IS 'URLs/sources from AI research';
COMMENT ON COLUMN sales_companies.research_date IS 'When AI research was performed';