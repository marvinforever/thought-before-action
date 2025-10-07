-- Create junction table for many-to-many relationship between resources and capabilities
CREATE TABLE public.resource_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  capability_id uuid NOT NULL REFERENCES public.capabilities(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(resource_id, capability_id)
);

-- Add RLS policies
ALTER TABLE public.resource_capabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view resource capabilities"
  ON public.resource_capabilities FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage resource capabilities"
  ON public.resource_capabilities FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Create indexes for performance
CREATE INDEX idx_resource_capabilities_resource_id ON public.resource_capabilities(resource_id);
CREATE INDEX idx_resource_capabilities_capability_id ON public.resource_capabilities(capability_id);

-- Migrate existing data from resources.capability_id to junction table
INSERT INTO public.resource_capabilities (resource_id, capability_id)
SELECT id, capability_id
FROM public.resources
WHERE capability_id IS NOT NULL
ON CONFLICT (resource_id, capability_id) DO NOTHING;