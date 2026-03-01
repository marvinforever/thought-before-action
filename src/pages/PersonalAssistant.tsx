import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Plus, MessageSquare, Trash2, GripVertical, Folder, Calendar, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { JerichoChat } from "@/components/JerichoChat";
import { useNavigate } from "react-router-dom";

interface Task {
  id: string;
  title: string;
  description: string | null;
  column_status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
  project_id: string | null;
  created_by_jericho: boolean;
  source: string;
  category: "sales_customers" | "growth_plan" | "work" | "personal";
  user_projects?: { title: string; color: string } | null;
}

interface Project {
  id: string;
  title: string;
  description: string | null;
  color: string;
  status: string;
}

const COLUMNS = [
  { id: "todo", title: "To Do", color: "bg-slate-100 dark:bg-slate-800" },
  { id: "in_progress", title: "In Progress", color: "bg-blue-50 dark:bg-blue-950" },
  { id: "done", title: "Done", color: "bg-green-50 dark:bg-green-950" },
] as const;

const CATEGORIES = [
  { id: "sales_customers", label: "Sales & Customers", emoji: "🎯" },
  { id: "growth_plan", label: "Growth Plan", emoji: "📈" },
  { id: "work", label: "Work", emoji: "💼" },
  { id: "personal", label: "Personal", emoji: "🏠" },
] as const;

const PRIORITY_COLORS = {
  low: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  urgent: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

export default function PersonalAssistant() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [addingToColumn, setAddingToColumn] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      loadData();
      setupRealtime();
    }
  }, [user]);

  const checkAuth = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      navigate("/auth");
      return;
    }
    setUser(authUser);
  };

  const setupRealtime = () => {
    const channel = supabase
      .channel('project_tasks_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'project_tasks' },
        () => { loadData(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  };

  const loadData = async () => {
    const [tasksResult, projectsResult] = await Promise.all([
      supabase
        .from("project_tasks")
        .select("*, user_projects(title, color)")
        .order("position", { ascending: true }),
      supabase
        .from("user_projects")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false }),
    ]);

    if (tasksResult.error) {
      toast({ title: "Error loading tasks", variant: "destructive" });
    } else {
      setTasks((tasksResult.data || []) as Task[]);
    }

    if (!projectsResult.error) {
      setProjects((projectsResult.data || []) as Project[]);
    }

    setLoading(false);
  };

  const addTask = async (columnStatus: string, category: string) => {
    if (!newTaskTitle.trim() || !user) return;

    const { error } = await supabase.from("project_tasks").insert({
      profile_id: user.id,
      title: newTaskTitle,
      column_status: columnStatus,
      priority: "medium",
      position: tasks.filter((t) => t.column_status === columnStatus && t.category === category).length,
      source: "manual",
      category,
    });

    if (error) {
      toast({ title: "Error adding task", variant: "destructive" });
    } else {
      setNewTaskTitle("");
      setAddingToColumn(null);
      loadData();
    }
  };

  const moveTask = async (taskId: string, newStatus: string) => {
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, column_status: newStatus as Task["column_status"] } : t
    ));

    const { error } = await supabase
      .from("project_tasks")
      .update({ column_status: newStatus })
      .eq("id", taskId);

    if (error) {
      loadData();
      toast({ title: "Error moving task", variant: "destructive" });
    }
  };

  const deleteTask = async (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));

    const { error } = await supabase.from("project_tasks").delete().eq("id", taskId);
    if (error) {
      loadData();
      toast({ title: "Error deleting task", variant: "destructive" });
    }
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => { setDragOverColumn(null); };

  const handleDrop = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    if (draggedTaskId) {
      moveTask(draggedTaskId, columnId);
    }
    setDraggedTaskId(null);
    setDragOverColumn(null);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverColumn(null);
  };

  const toggleCategory = (categoryId: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  const getTasksForCategoryColumn = (categoryId: string, columnId: string) =>
    tasks.filter((t) => t.category === categoryId && t.column_status === columnId);

  const handleChatClose = useCallback(() => {
    setChatOpen(false);
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Personal Assistant</h1>
            <p className="text-muted-foreground text-sm md:text-base">
              Your private Kanban board managed by Jericho
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadData} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={() => setChatOpen(true)} className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Chat with Jericho
            </Button>
          </div>
        </div>

        {/* Projects Overview */}
        {projects.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
              <Folder className="h-4 w-4" />
              Projects
            </h2>
            <div className="flex flex-wrap gap-2">
              {projects.map((project) => (
                <Badge
                  key={project.id}
                  variant="outline"
                  className="px-3 py-1"
                  style={{ borderColor: project.color, color: project.color }}
                >
                  {project.title}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Category-grouped Kanban Boards */}
        <div className="space-y-6">
          {CATEGORIES.map((category) => {
            const categoryTasks = tasks.filter(t => t.category === category.id);
            const isCollapsed = collapsedCategories.has(category.id);

            return (
              <div key={category.id}>
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="flex items-center gap-2 mb-3 group cursor-pointer"
                >
                  <span className="text-xl">{category.emoji}</span>
                  <h2 className="text-lg font-semibold text-foreground">{category.label}</h2>
                  <Badge variant="secondary" className="font-normal text-xs">
                    {categoryTasks.length}
                  </Badge>
                  <span className="text-muted-foreground text-sm ml-1">
                    {isCollapsed ? "▸" : "▾"}
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {COLUMNS.map((column) => {
                      const addKey = `${category.id}_${column.id}`;
                      return (
                        <Card
                          key={column.id}
                          className={`${column.color} transition-all duration-200 ${
                            dragOverColumn === addKey ? "ring-2 ring-primary ring-offset-2" : ""
                          }`}
                          onDragOver={(e) => handleDragOver(e, addKey)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (draggedTaskId) moveTask(draggedTaskId, column.id);
                            setDraggedTaskId(null);
                            setDragOverColumn(null);
                          }}
                        >
                          <CardHeader className="pb-3">
                            <CardTitle className="flex items-center justify-between text-lg">
                              {column.title}
                              <Badge variant="secondary" className="font-normal">
                                {getTasksForCategoryColumn(category.id, column.id).length}
                              </Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2 min-h-[120px]">
                            {getTasksForCategoryColumn(category.id, column.id).map((task) => (
                              <div
                                key={task.id}
                                className={`bg-card rounded-lg p-3 shadow-sm border group cursor-grab active:cursor-grabbing transition-all duration-150 ${
                                  draggedTaskId === task.id ? "opacity-50 scale-95" : ""
                                }`}
                                draggable
                                onDragStart={(e) => handleDragStart(e, task.id)}
                                onDragEnd={handleDragEnd}
                              >
                                <div className="flex items-start gap-2">
                                  <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 mt-0.5 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm text-foreground">{task.title}</p>
                                    {task.description && (
                                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                        {task.description}
                                      </p>
                                    )}
                                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                      <Badge className={PRIORITY_COLORS[task.priority]} variant="secondary">
                                        {task.priority}
                                      </Badge>
                                      {task.due_date && (
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                          <Calendar className="h-3 w-3" />
                                          {new Date(task.due_date).toLocaleDateString()}
                                        </span>
                                      )}
                                      {task.created_by_jericho && (
                                        <Badge variant="outline" className="text-xs">Jericho</Badge>
                                      )}
                                      {task.source === "telegram" && (
                                        <Badge variant="outline" className="text-xs">Telegram</Badge>
                                      )}
                                      {task.user_projects && (
                                        <Badge
                                          variant="outline"
                                          className="text-xs"
                                          style={{ borderColor: task.user_projects.color }}
                                        >
                                          {task.user_projects.title}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 flex-shrink-0"
                                    onClick={() => deleteTask(task.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                                {column.id !== "done" && (
                                  <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {column.id === "todo" && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-xs h-6"
                                        onClick={() => moveTask(task.id, "in_progress")}
                                      >
                                        Start
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-xs h-6"
                                      onClick={() => moveTask(task.id, "done")}
                                    >
                                      Complete
                                    </Button>
                                  </div>
                                )}
                              </div>
                            ))}

                            {/* Add Task Form */}
                            {addingToColumn === addKey ? (
                              <div className="flex gap-2">
                                <Input
                                  placeholder="Task title..."
                                  value={newTaskTitle}
                                  onChange={(e) => setNewTaskTitle(e.target.value)}
                                  onKeyDown={(e) => e.key === "Enter" && addTask(column.id, category.id)}
                                  autoFocus
                                  className="bg-background"
                                />
                                <Button size="sm" onClick={() => addTask(column.id, category.id)}>
                                  Add
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setAddingToColumn(null)}>
                                  ×
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="ghost"
                                className="w-full justify-start text-muted-foreground hover:text-foreground"
                                onClick={() => setAddingToColumn(addKey)}
                              >
                                <Plus className="h-4 w-4 mr-2" /> Add task
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {tasks.length === 0 && (
          <div className="mt-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">No tasks yet</h3>
            <p className="text-muted-foreground mb-4 max-w-sm mx-auto">
              Start by adding tasks manually or chat with Jericho to have him manage your to-dos.
            </p>
            <Button onClick={() => setChatOpen(true)} className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Chat with Jericho
            </Button>
          </div>
        )}
      </div>

      {/* Jericho Chat */}
      <JerichoChat isOpen={chatOpen} onClose={handleChatClose} />
    </div>
  );
}
