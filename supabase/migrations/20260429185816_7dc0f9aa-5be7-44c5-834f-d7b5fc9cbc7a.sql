-- Supplier submissions table
CREATE TABLE public.supplier_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_company TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  product_categories TEXT,
  notes TEXT,
  file_paths TEXT[] NOT NULL DEFAULT '{}',
  file_names TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'new',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_submissions ENABLE ROW LEVEL SECURITY;

-- Anyone (anonymous) can submit
CREATE POLICY "Anyone can submit supplier info"
ON public.supplier_submissions FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only super admins can view / update
CREATE POLICY "Super admins can view submissions"
ON public.supplier_submissions FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update submissions"
ON public.supplier_submissions FOR UPDATE
TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete submissions"
ON public.supplier_submissions FOR DELETE
TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER update_supplier_submissions_updated_at
BEFORE UPDATE ON public.supplier_submissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Private storage bucket for supplier files
INSERT INTO storage.buckets (id, name, public)
VALUES ('supplier-submissions', 'supplier-submissions', false);

-- Anyone can upload to this bucket (public intake)
CREATE POLICY "Anyone can upload supplier files"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'supplier-submissions');

-- Only super admins can read/list files
CREATE POLICY "Super admins can read supplier files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'supplier-submissions' AND public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete supplier files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'supplier-submissions' AND public.is_super_admin(auth.uid()));