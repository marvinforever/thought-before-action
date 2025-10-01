-- Grant super admin privileges to Mark Jewell
UPDATE public.profiles 
SET is_super_admin = true 
WHERE email = 'mark@jvgrowth.com';