-- Update point values for daily login and chat
UPDATE public.point_config SET base_points = 5 WHERE activity_type = 'daily_login';
UPDATE public.point_config SET base_points = 10 WHERE activity_type = 'chat_conversation';