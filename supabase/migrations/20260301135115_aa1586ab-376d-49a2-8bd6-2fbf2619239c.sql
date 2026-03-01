
-- Create task_notes table
CREATE TABLE public.task_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.project_tasks(id) ON DELETE CASCADE NOT NULL,
  profile_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  note_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view notes on their tasks"
  ON public.task_notes FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.project_tasks pt
      WHERE pt.id = task_notes.task_id AND pt.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert notes on their tasks"
  ON public.task_notes FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.project_tasks pt
      WHERE pt.id = task_notes.task_id AND pt.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own notes"
  ON public.task_notes FOR DELETE TO authenticated
  USING (profile_id = auth.uid());

-- Privacy RLS: managers can see team tasks except personal category
CREATE POLICY "Block personal tasks from non-owners"
  ON public.project_tasks FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()
    OR (category != 'personal' AND (
      public.is_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.manager_assignments ma
        WHERE ma.employee_id = project_tasks.profile_id AND ma.manager_id = auth.uid()
      )
    ))
  );

-- Daily brief tasks function
CREATE OR REPLACE FUNCTION public.get_daily_brief_tasks(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  category text,
  priority text,
  due_date date,
  column_status text,
  is_overdue boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    pt.id, pt.title, pt.description, pt.category, pt.priority,
    pt.due_date, pt.column_status,
    (pt.due_date IS NOT NULL AND pt.due_date < CURRENT_DATE) AS is_overdue
  FROM public.project_tasks pt
  WHERE pt.profile_id = p_user_id
    AND pt.column_status IN ('todo', 'in_progress')
    AND (pt.due_date IS NULL OR pt.due_date <= CURRENT_DATE + INTERVAL '1 day')
  ORDER BY
    CASE pt.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END,
    pt.due_date ASC NULLS LAST;
$$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.task_notes;
