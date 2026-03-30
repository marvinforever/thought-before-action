import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Plus, MessageSquare, Trash2, GripVertical, Folder, Calendar, RefreshCw, X, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { JerichoChat } from "@/components/JerichoChat";
import { useNavigate, useLocation } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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

interface TaskNote {
  id: string;
  task_id: string;
  profile_id: string;
  note_text: string;
  created_at: string;
  profiles?: { full_name: string | null } | null;
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
  { id: "all", label: "All Tasks", emoji: "📋" },
  { id: "sales_customers", label: "Sales & Customers", emoji: "🎯" },
  { id: "growth_plan", label: "Growth Plan", emoji: "📈" },
  { id: "work", label: "Work", emoji: "💼" },
  { id: "personal", label: "Personal", emoji: "🏠" },
] as const;

const CATEGORY_OPTIONS = CATEGORIES.filter(c => c.id !== "all");

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
  const [newTaskCategory, setNewTaskCategory] = useState<string>("work");
  const [addingToColumn, setAddingToColumn] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskNotes, setTaskNotes] = useState<TaskNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [savingTask, setSavingTask] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_tasks' }, () => { loadData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  };

  const loadData = async () => {
    const [tasksResult, projectsResult] = await Promise.all([
      supabase
        .from("project_tasks")
        .select("*, user_projects(title, color)")
        .eq("profile_id", user.id)
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

  const loadTaskNotes = async (taskId: string) => {
    const { data, error } = await supabase
      .from("task_notes")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      // Fetch profile names for note authors
      const profileIds = [...new Set(data.map(n => n.profile_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", profileIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p.full_name]));

      setTaskNotes(data.map(n => ({
        ...n,
        profiles: { full_name: profileMap.get(n.profile_id) || null }
      })) as TaskNote[]);
    }
  };

  const addNote = async () => {
    if (!newNote.trim() || !selectedTask || !user) return;
    const { error } = await supabase.from("task_notes").insert({
      task_id: selectedTask.id,
      profile_id: user.id,
      note_text: newNote.trim(),
    });
    if (error) {
      toast({ title: "Error adding note", variant: "destructive" });
    } else {
      setNewNote("");
      loadTaskNotes(selectedTask.id);
    }
  };

  const openTaskDetail = (task: Task) => {
    setSelectedTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description || "");
    loadTaskNotes(task.id);
  };

  const saveTaskDetails = async (updates: Partial<Task>) => {
    if (!selectedTask) return;
    setSavingTask(true);
    const { error } = await supabase
      .from("project_tasks")
      .update(updates)
      .eq("id", selectedTask.id);

    if (error) {
      toast({ title: "Error saving task", variant: "destructive" });
    } else {
      setSelectedTask(prev => prev ? { ...prev, ...updates } : null);
      setTasks(prev => prev.map(t => t.id === selectedTask.id ? { ...t, ...updates } : t));
    }
    setSavingTask(false);
  };

  const addTask = async (columnStatus: string) => {
    if (!newTaskTitle.trim() || !user) return;
    const { error } = await supabase.from("project_tasks").insert({
      profile_id: user.id,
      title: newTaskTitle,
      column_status: columnStatus,
      priority: "medium",
      position: tasks.filter((t) => t.column_status === columnStatus).length,
      source: "manual",
      category: newTaskCategory,
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
    const { error } = await supabase.from("project_tasks").update({ column_status: newStatus }).eq("id", taskId);
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
    if (selectedTask?.id === taskId) setSelectedTask(null);
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
    if (draggedTaskId) moveTask(draggedTaskId, columnId);
    setDraggedTaskId(null);
    setDragOverColumn(null);
  };
  const handleDragEnd = () => { setDraggedTaskId(null); setDragOverColumn(null); };

  const handleChatClose = useCallback(() => {
    setChatOpen(false);
    loadData();
  }, []);

  const filteredTasks = categoryFilter === "all" ? tasks : tasks.filter(t => t.category === categoryFilter);

  const getTasksForColumn = (columnId: string) => filteredTasks.filter((t) => t.column_status === columnId);

  const getCategoryLabel = (id: string) => {
    const cat = CATEGORY_OPTIONS.find(c => c.id === id);
    return cat ? `${cat.emoji} ${cat.label}` : id;
  };

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
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.emoji} {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              <Folder className="h-4 w-4" /> Projects
            </h2>
            <div className="flex flex-wrap gap-2">
              {projects.map((project) => (
                <Badge key={project.id} variant="outline" className="px-3 py-1" style={{ borderColor: project.color, color: project.color }}>
                  {project.title}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Kanban Board */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNS.map((column) => (
            <Card
              key={column.id}
              className={`${column.color} transition-all duration-200 ${
                dragOverColumn === column.id ? "ring-2 ring-primary ring-offset-2" : ""
              }`}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-lg">
                  {column.title}
                  <Badge variant="secondary" className="font-normal">
                    {getTasksForColumn(column.id).length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 min-h-[120px]">
                {getTasksForColumn(column.id).map((task) => (
                  <div
                    key={task.id}
                    className={`bg-card rounded-lg p-3 shadow-sm border group cursor-pointer transition-all duration-150 ${
                      draggedTaskId === task.id ? "opacity-50 scale-95" : ""
                    }`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => openTaskDetail(task)}
                  >
                    <div className="flex items-start gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 mt-0.5 flex-shrink-0 cursor-grab active:cursor-grabbing" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground">{task.title}</p>
                        {task.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <Badge className={PRIORITY_COLORS[task.priority]} variant="secondary">
                            {task.priority}
                          </Badge>
                          {categoryFilter === "all" && (
                            <Badge variant="outline" className="text-xs">
                              {CATEGORY_OPTIONS.find(c => c.id === task.category)?.emoji} {CATEGORY_OPTIONS.find(c => c.id === task.category)?.label}
                            </Badge>
                          )}
                          {task.due_date && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(task.due_date).toLocaleDateString()}
                            </span>
                          )}
                          {task.created_by_jericho && <Badge variant="outline" className="text-xs">Jericho</Badge>}
                          {task.source === "telegram" && <Badge variant="outline" className="text-xs">Telegram</Badge>}
                          {task.user_projects && (
                            <Badge variant="outline" className="text-xs" style={{ borderColor: task.user_projects.color }}>
                              {task.user_projects.title}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 flex-shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete task?</AlertDialogTitle>
                            <AlertDialogDescription>This will permanently delete "{task.title}". This action cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteTask(task.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                    {column.id !== "done" && (
                      <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {column.id === "todo" && (
                          <Button size="sm" variant="outline" className="text-xs h-6" onClick={(e) => { e.stopPropagation(); moveTask(task.id, "in_progress"); }}>
                            Start
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="text-xs h-6" onClick={(e) => { e.stopPropagation(); moveTask(task.id, "done"); }}>
                          Complete
                        </Button>
                      </div>
                    )}
                  </div>
                ))}

                {/* Add Task Form */}
                {addingToColumn === column.id ? (
                  <div className="space-y-2">
                    <Input
                      placeholder="Task title..."
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addTask(column.id)}
                      autoFocus
                      className="bg-background"
                    />
                    <Select value={newTaskCategory} onValueChange={setNewTaskCategory}>
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORY_OPTIONS.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.emoji} {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => addTask(column.id)}>Add</Button>
                      <Button size="sm" variant="ghost" onClick={() => setAddingToColumn(null)}>×</Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-muted-foreground hover:text-foreground"
                    onClick={() => setAddingToColumn(column.id)}
                  >
                    <Plus className="h-4 w-4 mr-2" /> Add task
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
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
              <MessageSquare className="h-4 w-4" /> Chat with Jericho
            </Button>
          </div>
        )}
      </div>

      {/* Task Detail Modal */}
      <Dialog open={!!selectedTask} onOpenChange={(open) => { if (!open) setSelectedTask(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="sr-only">Task Details</DialogTitle>
          </DialogHeader>

          {selectedTask && (
            <div className="space-y-4">
              {/* Title */}
              <div>
                <Label className="text-xs text-muted-foreground">Title</Label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={() => { if (editTitle !== selectedTask.title) saveTaskDetails({ title: editTitle }); }}
                  className="text-lg font-semibold border-none px-0 shadow-none focus-visible:ring-0"
                />
              </div>

              {/* Description */}
              <div>
                <Label className="text-xs text-muted-foreground">Description</Label>
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  onBlur={() => { if (editDescription !== (selectedTask.description || "")) saveTaskDetails({ description: editDescription || null }); }}
                  placeholder="Add a description..."
                  className="min-h-[80px] resize-none"
                />
              </div>

              {/* Status, Priority, Category row */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Select
                    value={selectedTask.column_status}
                    onValueChange={(value) => {
                      saveTaskDetails({ column_status: value as Task["column_status"] });
                      moveTask(selectedTask.id, value);
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COLUMNS.map(col => <SelectItem key={col.id} value={col.id}>{col.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Priority</Label>
                  <Select
                    value={selectedTask.priority}
                    onValueChange={(value) => saveTaskDetails({ priority: value as Task["priority"] })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Category</Label>
                  <Select
                    value={selectedTask.category}
                    onValueChange={(value) => saveTaskDetails({ category: value as Task["category"] })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.emoji} {cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Due Date */}
              <div>
                <Label className="text-xs text-muted-foreground">Due Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !selectedTask.due_date && "text-muted-foreground")}>
                      <Calendar className="mr-2 h-4 w-4" />
                      {selectedTask.due_date ? format(new Date(selectedTask.due_date), "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={selectedTask.due_date ? new Date(selectedTask.due_date) : undefined}
                      onSelect={(date) => saveTaskDetails({ due_date: date ? date.toISOString().split('T')[0] : null })}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                {selectedTask.due_date && (
                  <Button variant="ghost" size="sm" className="text-xs mt-1" onClick={() => saveTaskDetails({ due_date: null })}>
                    Clear date
                  </Button>
                )}
              </div>

              {/* Notes Section */}
              <div className="border-t pt-4">
                <Label className="text-xs text-muted-foreground mb-2 block">Notes</Label>
                <div className="flex gap-2 mb-3">
                  <Textarea
                    placeholder="Add a note..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="min-h-[60px] resize-none flex-1"
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addNote(); } }}
                  />
                  <Button size="icon" onClick={addNote} disabled={!newNote.trim()} className="self-end">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-3 max-h-[200px] overflow-y-auto">
                  {taskNotes.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-2">No notes yet</p>
                  )}
                  {taskNotes.map((note) => (
                    <div key={note.id} className="bg-muted rounded-lg p-3">
                      <p className="text-sm text-foreground whitespace-pre-wrap">{note.note_text}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted-foreground">
                          {(note as any).profiles?.full_name || "You"} · {format(new Date(note.created_at), "MMM d, h:mm a")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Delete Task */}
              <div className="border-t pt-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="w-full">
                      <Trash2 className="h-4 w-4 mr-2" /> Delete Task
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete task?</AlertDialogTitle>
                      <AlertDialogDescription>This will permanently delete "{selectedTask.title}". This action cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteTask(selectedTask.id)}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Jericho Chat */}
      <JerichoChat isOpen={chatOpen} onClose={handleChatClose} />
    </div>
  );
}
