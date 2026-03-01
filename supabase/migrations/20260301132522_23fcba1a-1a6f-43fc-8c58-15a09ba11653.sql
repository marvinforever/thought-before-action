
-- Add category column with default 'work'
ALTER TABLE public.project_tasks 
ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'work';

-- Add check constraint for category values
ALTER TABLE public.project_tasks 
ADD CONSTRAINT project_tasks_category_check 
CHECK (category IN ('sales_customers', 'growth_plan', 'work', 'personal'));

-- Drop old source constraint if it exists
ALTER TABLE public.project_tasks DROP CONSTRAINT IF EXISTS project_tasks_source_check;

-- Add updated source constraint
ALTER TABLE public.project_tasks 
ADD CONSTRAINT project_tasks_source_check 
CHECK (source IN ('manual', 'voice', 'chat', 'telegram'));

-- Migrate existing tasks without a category (already handled by default, but be explicit)
UPDATE public.project_tasks SET category = 'work' WHERE category IS NULL;

-- RLS policy: managers cannot see 'personal' tasks of other users
-- First drop any existing manager-view policy if present
DROP POLICY IF EXISTS "Managers can view team tasks except personal" ON public.project_tasks;

-- Create policy: users see all own tasks; managers see non-personal tasks of their reports
CREATE POLICY "Managers can view team tasks except personal"
ON public.project_tasks
FOR SELECT
TO authenticated
USING (
  profile_id = auth.uid()
  OR (
    category != 'personal'
    AND EXISTS (
      SELECT 1 FROM public.manager_assignments ma
      WHERE ma.manager_id = auth.uid()
      AND ma.employee_id = project_tasks.profile_id
    )
  )
  OR public.is_super_admin(auth.uid())
);
