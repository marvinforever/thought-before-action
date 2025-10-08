-- Enable RLS (safe if already enabled)
ALTER TABLE public.strategic_learning_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategic_learning_notifications ENABLE ROW LEVEL SECURITY;

-- Insert policy for reports (admins of company or super admins)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'strategic_learning_reports' AND policyname = 'Admins and super admins can insert reports'
  ) THEN
    CREATE POLICY "Admins and super admins can insert reports"
    ON public.strategic_learning_reports
    FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_super_admin = true
      )
      OR
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_admin = true AND p.company_id = company_id
      )
    );
  END IF;
END$$;

-- Insert policy for cohorts referencing report company
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'training_cohorts' AND policyname = 'Insert cohorts via matching report company'
  ) THEN
    CREATE POLICY "Insert cohorts via matching report company"
    ON public.training_cohorts
    FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.strategic_learning_reports r
        JOIN public.profiles p ON p.id = auth.uid()
        WHERE r.id = report_id
          AND (
            p.is_super_admin = true OR (p.is_admin = true AND r.company_id = p.company_id)
          )
      )
    );
  END IF;
END$$;

-- Insert policy for notifications (admins of company or super admins)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'strategic_learning_notifications' AND policyname = 'Admins and super admins can insert notifications'
  ) THEN
    CREATE POLICY "Admins and super admins can insert notifications"
    ON public.strategic_learning_notifications
    FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND (
          p.is_super_admin = true OR (p.is_admin = true AND p.company_id = company_id)
        )
      )
    );
  END IF;
END$$;