-- Create projects table for Kanban-style project management
CREATE TABLE public.user_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create project tasks table with Kanban columns
CREATE TABLE public.project_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.user_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  column_status TEXT NOT NULL DEFAULT 'todo' CHECK (column_status IN ('todo', 'in_progress', 'done')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date DATE,
  position INTEGER NOT NULL DEFAULT 0,
  created_by_jericho BOOLEAN DEFAULT false,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'chat', 'voice')),
  context JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.user_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_projects (users can only see their own)
CREATE POLICY "Users can view their own projects"
  ON public.user_projects FOR SELECT
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can create their own projects"
  ON public.user_projects FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can update their own projects"
  ON public.user_projects FOR UPDATE
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can delete their own projects"
  ON public.user_projects FOR DELETE
  USING (auth.uid() = profile_id);

-- RLS policies for project_tasks
CREATE POLICY "Users can view their own tasks"
  ON public.project_tasks FOR SELECT
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can create their own tasks"
  ON public.project_tasks FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can update their own tasks"
  ON public.project_tasks FOR UPDATE
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can delete their own tasks"
  ON public.project_tasks FOR DELETE
  USING (auth.uid() = profile_id);

-- Create updated_at triggers
CREATE TRIGGER update_user_projects_updated_at
  BEFORE UPDATE ON public.user_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_tasks_updated_at
  BEFORE UPDATE ON public.project_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for efficient queries
CREATE INDEX idx_project_tasks_profile_id ON public.project_tasks(profile_id);
CREATE INDEX idx_project_tasks_project_id ON public.project_tasks(project_id);
CREATE INDEX idx_project_tasks_column_status ON public.project_tasks(column_status);
CREATE INDEX idx_user_projects_profile_id ON public.user_projects(profile_id);