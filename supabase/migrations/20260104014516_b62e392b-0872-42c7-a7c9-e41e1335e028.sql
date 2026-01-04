-- Enable realtime for recognition_notes table
ALTER PUBLICATION supabase_realtime ADD TABLE recognition_notes;

-- Create meeting_requests table for employees to request meetings with managers
CREATE TABLE public.meeting_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID REFERENCES public.profiles(id) NOT NULL,
  requested_manager_id UUID REFERENCES public.profiles(id) NOT NULL,
  company_id UUID REFERENCES public.companies(id) NOT NULL,
  topic TEXT,
  urgency TEXT DEFAULT 'normal' CHECK (urgency IN ('low', 'normal', 'high')),
  preferred_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'scheduled')),
  scheduled_date TIMESTAMPTZ,
  manager_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meeting_requests ENABLE ROW LEVEL SECURITY;

-- Employees can create requests for their manager
CREATE POLICY "Employees can create meeting requests"
ON public.meeting_requests
FOR INSERT
WITH CHECK (auth.uid() = requester_id);

-- Employees can view their own requests
CREATE POLICY "Employees can view own requests"
ON public.meeting_requests
FOR SELECT
USING (auth.uid() = requester_id);

-- Managers can view requests where they are the requested manager
CREATE POLICY "Managers can view requests for them"
ON public.meeting_requests
FOR SELECT
USING (auth.uid() = requested_manager_id);

-- Managers can update requests where they are the requested manager
CREATE POLICY "Managers can update requests for them"
ON public.meeting_requests
FOR UPDATE
USING (auth.uid() = requested_manager_id);

-- Employees can cancel their own pending requests
CREATE POLICY "Employees can delete own pending requests"
ON public.meeting_requests
FOR DELETE
USING (auth.uid() = requester_id AND status = 'pending');

-- Create updated_at trigger
CREATE TRIGGER update_meeting_requests_updated_at
BEFORE UPDATE ON public.meeting_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for meeting_requests
ALTER PUBLICATION supabase_realtime ADD TABLE meeting_requests;