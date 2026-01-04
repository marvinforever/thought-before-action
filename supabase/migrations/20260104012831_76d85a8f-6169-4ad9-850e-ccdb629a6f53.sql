-- Add scheduled_time columns for calendar invite support
ALTER TABLE public.one_on_one_notes 
ADD COLUMN IF NOT EXISTS scheduled_time TIME DEFAULT NULL,
ADD COLUMN IF NOT EXISTS calendar_invite_sent BOOLEAN DEFAULT FALSE;

ALTER TABLE public.performance_reviews
ADD COLUMN IF NOT EXISTS scheduled_time TIME DEFAULT NULL,
ADD COLUMN IF NOT EXISTS calendar_invite_sent BOOLEAN DEFAULT FALSE;

-- Comment for documentation
COMMENT ON COLUMN public.one_on_one_notes.scheduled_time IS 'Time for next scheduled 1:1 meeting';
COMMENT ON COLUMN public.one_on_one_notes.calendar_invite_sent IS 'Whether a calendar invite was sent for this meeting';
COMMENT ON COLUMN public.performance_reviews.scheduled_time IS 'Time for scheduled review meeting';
COMMENT ON COLUMN public.performance_reviews.calendar_invite_sent IS 'Whether a calendar invite was sent for this review';