-- Public helper to resolve a referral code to a partner id without exposing partner data via RLS
CREATE OR REPLACE FUNCTION public.get_partner_id_by_referral_code(p_referral_code text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.referral_partners
  WHERE referral_code = upper(trim(p_referral_code))
    AND status = 'active'
  LIMIT 1
$$;