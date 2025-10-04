-- Create role enum
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'manager', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get user's highest role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY CASE role
    WHEN 'super_admin' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'manager' THEN 3
    WHEN 'user' THEN 4
  END
  LIMIT 1
$$;

-- RLS policies for user_roles
CREATE POLICY "Super admins can manage all roles"
ON public.user_roles
FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can view roles in their company"
ON public.user_roles
FOR SELECT
USING (
  user_id IN (
    SELECT id FROM profiles 
    WHERE company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  )
);

CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (user_id = auth.uid());

-- Create manager_assignments table
CREATE TABLE public.manager_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  employee_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id),
  UNIQUE(employee_id)
);

-- Enable RLS
ALTER TABLE public.manager_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies for manager_assignments
CREATE POLICY "Super admins can manage all assignments"
ON public.manager_assignments
FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can manage assignments in their company"
ON public.manager_assignments
FOR ALL
USING (
  company_id IN (
    SELECT company_id FROM profiles 
    WHERE id = auth.uid() AND is_admin = true
  )
);

CREATE POLICY "Managers can view their assignments"
ON public.manager_assignments
FOR SELECT
USING (manager_id = auth.uid());

-- Migrate existing data: Create roles for existing users
INSERT INTO public.user_roles (user_id, role)
SELECT id, 
  CASE 
    WHEN is_super_admin THEN 'super_admin'::app_role
    WHEN is_admin THEN 'admin'::app_role
    ELSE 'user'::app_role
  END
FROM profiles
WHERE id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Create capability_adjustments table for tracking manager changes
CREATE TABLE public.capability_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_capability_id UUID REFERENCES employee_capabilities(id) ON DELETE CASCADE NOT NULL,
  profile_id UUID REFERENCES profiles(id) NOT NULL,
  adjusted_by UUID REFERENCES profiles(id) NOT NULL,
  previous_level TEXT NOT NULL,
  new_level TEXT NOT NULL,
  previous_priority INTEGER,
  new_priority INTEGER,
  adjustment_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.capability_adjustments ENABLE ROW LEVEL SECURITY;

-- RLS policies for capability_adjustments
CREATE POLICY "Managers can view adjustments for their reports"
ON public.capability_adjustments
FOR SELECT
USING (
  profile_id IN (
    SELECT employee_id FROM manager_assignments 
    WHERE manager_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all adjustments in their company"
ON public.capability_adjustments
FOR SELECT
USING (
  profile_id IN (
    SELECT id FROM profiles 
    WHERE company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  )
);

CREATE POLICY "System can insert adjustments"
ON public.capability_adjustments
FOR INSERT
WITH CHECK (true);