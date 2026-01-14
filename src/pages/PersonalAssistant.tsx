import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Plus, MessageSquare, Trash2, GripVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { JerichoChat } from "@/components/JerichoChat";

interface Task {
  id: string;
  title: string;
  description: string | null;
  column_status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
  project_id: string | null;
  user_projects?: { title: string; color: string } | null;
}

const COLUMNS = [
  { id: "todo", title: "To Do", color: "bg-slate-100" },
  { id: "in_progress", title: "In Progress", color: "bg-blue-50" },
  { id: "done", title: "Done", color: "bg-green-50" },
] as const;

const PRIORITY_COLORS = {
  low: "bg-slate-200 text-slate-700",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

export default function PersonalAssistant() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [addingToColumn, setAddingToColumn] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    const { data, error } = await supabase
      .from("project_tasks")
      .select("*, user_projects(title, color)")
      .order("position", { ascending: true });

    if (error) {
      toast({ title: "Error loading tasks", variant: "destructive" });
    } else {
      setTasks((data || []) as Task[]);
    }
    setLoading(false);
  };

  const addTask = async (columnStatus: string) => {
    if (!newTaskTitle.trim()) return;

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { error } = await supabase.from("project_tasks").insert({
      profile_id: userData.user.id,
      title: newTaskTitle,
      column_status: columnStatus,
      priority: "medium",
      position: tasks.filter((t) => t.column_status === columnStatus).length,
      source: "manual",
    });

    if (error) {
      toast({ title: "Error adding task", variant: "destructive" });
    } else {
      setNewTaskTitle("");
      setAddingToColumn(null);
      loadTasks();
    }
  };

  const moveTask = async (taskId: string, newStatus: string) => {
    const { error } = await supabase
      .from("project_tasks")
      .update({ column_status: newStatus })
      .eq("id", taskId);

    if (!error) loadTasks();
  };

  const deleteTask = async (taskId: string) => {
    const { error } = await supabase.from("project_tasks").delete().eq("id", taskId);
    if (!error) loadTasks();
  };

  const getTasksForColumn = (columnId: string) =>
    tasks.filter((t) => t.column_status === columnId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Personal Assistant</h1>
            <p className="text-muted-foreground">Your private Kanban board managed by Jericho</p>
          </div>
          <Button onClick={() => setChatOpen(true)} className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Chat with Jericho
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNS.map((column) => (
            <Card key={column.id} className={column.color}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-lg">
                  {column.title}
                  <Badge variant="secondary">{getTasksForColumn(column.id).length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {getTasksForColumn(column.id).map((task) => (
                  <div
                    key={task.id}
                    className="bg-white rounded-lg p-3 shadow-sm border group"
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("taskId", task.id)}
                  >
                    <div className="flex items-start gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{task.title}</p>
                        {task.description && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {task.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge className={PRIORITY_COLORS[task.priority]} variant="secondary">
                            {task.priority}
                          </Badge>
                          {task.due_date && (
                            <span className="text-xs text-muted-foreground">
                              {new Date(task.due_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                        onClick={() => deleteTask(task.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    {column.id !== "done" && (
                      <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100">
                        {column.id === "todo" && (
                          <Button size="sm" variant="outline" className="text-xs h-6" onClick={() => moveTask(task.id, "in_progress")}>
                            Start
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="text-xs h-6" onClick={() => moveTask(task.id, "done")}>
                          Complete
                        </Button>
                      </div>
                    )}
                  </div>
                ))}

                {addingToColumn === column.id ? (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Task title..."
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addTask(column.id)}
                      autoFocus
                    />
                    <Button size="sm" onClick={() => addTask(column.id)}>Add</Button>
                    <Button size="sm" variant="ghost" onClick={() => setAddingToColumn(null)}>×</Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-muted-foreground"
                    onClick={() => setAddingToColumn(column.id)}
                  >
                    <Plus className="h-4 w-4 mr-2" /> Add task
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <JerichoChat isOpen={chatOpen} onClose={() => { setChatOpen(false); loadTasks(); }} />
    </div>
  );
}
