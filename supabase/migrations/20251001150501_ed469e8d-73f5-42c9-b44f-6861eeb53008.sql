-- Correct profile: grant super admin to the currently logged-in user
UPDATE public.profiles
SET is_super_admin = true
WHERE id = '426a334a-e1b5-41e8-a4ee-6d3e973f5b49';