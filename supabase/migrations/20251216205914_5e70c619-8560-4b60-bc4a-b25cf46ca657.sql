-- Add RLS policies for managers to view their direct reports' growth data

-- 1. ninety_day_targets - Allow managers to view their direct reports' 90-day goals
CREATE POLICY "Managers can view targets for their direct reports"
  ON public.ninety_day_targets FOR SELECT
  USING (profile_id IN (
    SELECT employee_id FROM manager_assignments 
    WHERE manager_id = auth.uid()
  ));

-- 2. leading_indicators - Allow managers to view their direct reports' habits
CREATE POLICY "Managers can view habits for their direct reports"
  ON public.leading_indicators FOR SELECT
  USING (profile_id IN (
    SELECT employee_id FROM manager_assignments 
    WHERE manager_id = auth.uid()
  ));

-- 3. achievements - Allow managers to view their direct reports' achievements
CREATE POLICY "Managers can view achievements for their direct reports"
  ON public.achievements FOR SELECT
  USING (profile_id IN (
    SELECT employee_id FROM manager_assignments 
    WHERE manager_id = auth.uid()
  ));

-- 4. personal_goals - Allow managers to view their direct reports' vision
CREATE POLICY "Managers can view goals for their direct reports"
  ON public.personal_goals FOR SELECT
  USING (profile_id IN (
    SELECT employee_id FROM manager_assignments 
    WHERE manager_id = auth.uid()
  ));