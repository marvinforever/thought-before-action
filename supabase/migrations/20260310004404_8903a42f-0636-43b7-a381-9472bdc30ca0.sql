-- Auto-create user_active_context row when a new profile is created
CREATE OR REPLACE FUNCTION public.auto_create_user_active_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.user_active_context (profile_id, company_id, onboarding_complete, onboarding_step, onboarding_path)
  VALUES (NEW.id, NEW.company_id, false, 0, 'pending')
  ON CONFLICT (profile_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_user_active_context ON public.profiles;
CREATE TRIGGER trg_auto_create_user_active_context
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_user_active_context();