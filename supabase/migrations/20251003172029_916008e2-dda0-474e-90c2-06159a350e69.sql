
-- Add audit logging table for company changes
CREATE TABLE IF NOT EXISTS public.profile_company_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  old_company_id UUID REFERENCES public.companies(id),
  new_company_id UUID REFERENCES public.companies(id),
  changed_by UUID,
  changed_at TIMESTAMPTZ DEFAULT now(),
  change_source TEXT
);

-- Enable RLS on audit table
ALTER TABLE public.profile_company_changes ENABLE ROW LEVEL SECURITY;

-- Only super admins can view audit logs
CREATE POLICY "Super admins can view company change logs"
  ON public.profile_company_changes
  FOR SELECT
  USING (is_super_admin(auth.uid()));

-- Create trigger function to log company changes
CREATE OR REPLACE FUNCTION public.log_company_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only log if company_id actually changed
  IF (TG_OP = 'UPDATE' AND OLD.company_id IS DISTINCT FROM NEW.company_id) THEN
    INSERT INTO public.profile_company_changes (
      profile_id,
      old_company_id,
      new_company_id,
      changed_by,
      change_source
    ) VALUES (
      NEW.id,
      OLD.company_id,
      NEW.company_id,
      auth.uid(),
      'profile_update'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on profiles table
DROP TRIGGER IF EXISTS track_company_changes ON public.profiles;
CREATE TRIGGER track_company_changes
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_company_change();

-- Add check constraint to prevent null company_id for active users
-- (Allow NULL only for inactive/deleted users)
ALTER TABLE public.profiles 
  DROP CONSTRAINT IF EXISTS profiles_company_id_check;
  
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_company_id_check 
  CHECK (
    (is_active = false) OR 
    (company_id IS NOT NULL)
  );
