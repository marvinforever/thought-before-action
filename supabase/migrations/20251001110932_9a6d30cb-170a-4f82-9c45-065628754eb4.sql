-- Add new fields to resources table for enhanced content metadata
ALTER TABLE public.resources 
  ADD COLUMN authors text,
  ADD COLUMN publisher text,
  ADD COLUMN rating numeric(2,1) CHECK (rating >= 0 AND rating <= 5),
  ADD COLUMN external_id text,
  ADD COLUMN external_url text;

-- Create index on external_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_resources_external_id ON public.resources(external_id);

-- Create index on capability_id and capability_level for filtered queries
CREATE INDEX IF NOT EXISTS idx_resources_capability_level ON public.resources(capability_id, capability_level);