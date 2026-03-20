ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_channel text DEFAULT 'web';

-- Use a validation trigger instead of CHECK constraint
CREATE OR REPLACE FUNCTION public.validate_preferred_channel()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.preferred_channel IS NOT NULL AND NEW.preferred_channel NOT IN ('sms', 'email', 'web') THEN
    RAISE EXCEPTION 'preferred_channel must be sms, email, or web';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_preferred_channel
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_preferred_channel();