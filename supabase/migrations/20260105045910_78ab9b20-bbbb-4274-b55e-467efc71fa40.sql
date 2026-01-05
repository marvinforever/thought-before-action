-- Grant minimal privileges to API roles; RLS still enforces access control
GRANT SELECT, INSERT, UPDATE ON TABLE public.referral_partners TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.referral_leads TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.referral_payouts TO anon, authenticated;