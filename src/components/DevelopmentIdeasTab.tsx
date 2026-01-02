import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Lightbulb, Trash2, Pencil, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface DevelopmentIdea {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const categoryColors: Record<string, string> = {
  feature: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  improvement: "bg-green-500/10 text-green-600 border-green-500/20",
  integration: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  experiment: "bg-orange-500/10 text-orange-600 border-orange-500/20",
};

const priorityColors: Record<string, string> = {
  low: "bg-gray-500/10 text-gray-600 border-gray-500/20",
  medium: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  high: "bg-red-500/10 text-red-600 border-red-500/20",
};

const statusColors: Record<string, string> = {
  idea: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  exploring: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  planned: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  in_progress: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  completed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  archived: "bg-neutral-500/10 text-neutral-600 border-neutral-500/20",
};

export const DevelopmentIdeasTab = () => {
  const [ideas, setIdeas] = useState<DevelopmentIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingIdea, setEditingIdea] = useState<DevelopmentIdea | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "feature",
    priority: "medium",
    status: "idea",
  });

  const { toast } = useToast();

  useEffect(() => {
    loadIdeas();
  }, []);

  const loadIdeas = async () => {
    try {
      const { data, error } = await supabase
        .from("development_ideas")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setIdeas(data || []);
    } catch (error) {
      console.error("Error loading ideas:", error);
      toast({
        title: "Error",
        description: "Failed to load development ideas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (idea?: DevelopmentIdea) => {
    if (idea) {
      setEditingIdea(idea);
      setFormData({
        title: idea.title,
        description: idea.description || "",
        category: idea.category,
        priority: idea.priority,
        status: idea.status,
      });
    } else {
      setEditingIdea(null);
      setFormData({
        title: "",
        description: "",
        category: "feature",
        priority: "medium",
        status: "idea",
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast({
        title: "Error",
        description: "Title is required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      if (editingIdea) {
        const { error } = await supabase
          .from("development_ideas")
          .update({
            title: formData.title.trim(),
            description: formData.description.trim() || null,
            category: formData.category,
            priority: formData.priority,
            status: formData.status,
          })
          .eq("id", editingIdea.id);

        if (error) throw error;
        toast({ title: "Idea updated" });
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { error } = await supabase
          .from("development_ideas")
          .insert({
            title: formData.title.trim(),
            description: formData.description.trim() || null,
            category: formData.category,
            priority: formData.priority,
            status: formData.status,
            created_by: user?.id,
          });

        if (error) throw error;
        toast({ title: "Idea saved" });
      }

      setIsDialogOpen(false);
      loadIdeas();
    } catch (error) {
      console.error("Error saving idea:", error);
      toast({
        title: "Error",
        description: "Failed to save idea",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const { error } = await supabase
        .from("development_ideas")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Idea deleted" });
      loadIdeas();
    } catch (error) {
      console.error("Error deleting idea:", error);
      toast({
        title: "Error",
        description: "Failed to delete idea",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              Development Ideas
            </CardTitle>
            <CardDescription>
              Capture feature ideas and development requests for future reference
            </CardDescription>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Idea
          </Button>
        </CardHeader>
        <CardContent>
          {ideas.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No development ideas yet.</p>
              <p className="text-sm">Click "Add Idea" to capture your first one.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {ideas.map((idea) => (
                <div
                  key={idea.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <h3 className="font-medium">{idea.title}</h3>
                        <Badge variant="outline" className={categoryColors[idea.category]}>
                          {idea.category}
                        </Badge>
                        <Badge variant="outline" className={priorityColors[idea.priority]}>
                          {idea.priority}
                        </Badge>
                        <Badge variant="outline" className={statusColors[idea.status]}>
                          {idea.status.replace("_", " ")}
                        </Badge>
                      </div>
                      {idea.description && (
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {idea.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        Added {format(new Date(idea.created_at), "MMM d, yyyy")}
                        {idea.updated_at !== idea.created_at && (
                          <> · Updated {format(new Date(idea.updated_at), "MMM d, yyyy")}</>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(idea)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(idea.id)}
                        disabled={deleting === idea.id}
                      >
                        {deleting === idea.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 text-destructive" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingIdea ? "Edit Idea" : "Add Development Idea"}
            </DialogTitle>
            <DialogDescription>
              Capture a feature idea or development request
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Perplexity integration for real-time resource discovery"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the idea, use cases, and potential implementation..."
                rows={5}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="feature">Feature</SelectItem>
                    <SelectItem value="improvement">Improvement</SelectItem>
                    <SelectItem value="integration">Integration</SelectItem>
                    <SelectItem value="experiment">Experiment</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData({ ...formData, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="idea">Idea</SelectItem>
                    <SelectItem value="exploring">Exploring</SelectItem>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingIdea ? "Update" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
