-- Create function to allow company admins to create profiles in their company
CREATE OR REPLACE FUNCTION public.admin_create_profile(
  p_admin_id uuid,
  p_email text,
  p_full_name text DEFAULT NULL,
  p_is_admin boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_new_id uuid := gen_random_uuid();
BEGIN
  -- Ensure caller is a company admin
  SELECT company_id INTO v_company_id
  FROM public.profiles
  WHERE id = p_admin_id AND is_admin = true;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Not authorized to create profiles';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, company_id, is_admin)
  VALUES (v_new_id, lower(trim(p_email)), p_full_name, v_company_id, COALESCE(p_is_admin, false));

  RETURN v_new_id;
END;
$$;

-- Restrict public access and allow only authenticated users to call
REVOKE ALL ON FUNCTION public.admin_create_profile(uuid, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_profile(uuid, text, text, boolean) TO authenticated;