
-- Add delivery_channels to email_preferences for multi-channel brief delivery
ALTER TABLE public.email_preferences 
ADD COLUMN IF NOT EXISTS delivery_channels jsonb NOT NULL DEFAULT '{"email": true, "telegram": false, "sms": false}'::jsonb;

-- Add channel column to email_deliveries for tracking which channel was used
ALTER TABLE public.email_deliveries 
ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'email';
