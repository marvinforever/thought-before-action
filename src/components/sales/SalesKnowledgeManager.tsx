import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Search,
  FileText,
  Upload,
  Trash2,
  Pencil,
  BookOpen,
  Target,
  MessageSquare,
  Loader2,
  FileUp,
  Check,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SalesKnowledgeManagerProps {
  userId: string;
  companyId: string;
}

interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  category: string | null;
  stage: string | null;
  tags: string[] | null;
  file_url?: string | null;
  file_name?: string | null;
  file_type?: string | null;
  created_at: string;
  is_active: boolean | null;
}

const CATEGORIES = [
  { value: "product_catalog", label: "Product Catalog", icon: BookOpen },
  { value: "product_sheet", label: "Product Sheet", icon: FileText },
  { value: "objection_handling", label: "Objection Handling", icon: MessageSquare },
  { value: "sales_scripts", label: "Sales Scripts", icon: FileText },
  { value: "competitor_intel", label: "Competitor Intel", icon: Target },
  { value: "training", label: "Training Material", icon: BookOpen },
];

const STAGES = [
  { value: "prospecting", label: "Prospecting" },
  { value: "discovery", label: "Discovery" },
  { value: "proposal", label: "Proposal" },
  { value: "closing", label: "Closing" },
  { value: "follow_up", label: "Follow Up" },
];

export function SalesKnowledgeManager({ userId, companyId }: SalesKnowledgeManagerProps) {
  const { toast } = useToast();
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Form state
  const [editingItem, setEditingItem] = useState<KnowledgeItem | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "",
    stage: "",
    tags: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    fetchKnowledge();
  }, [companyId]);

  const fetchKnowledge = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("sales_knowledge")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setKnowledge(data);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({ title: "", content: "", category: "", stage: "", tags: "" });
    setSelectedFile(null);
    setEditingItem(null);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum size is 50MB", variant: "destructive" });
      return;
    }

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Please upload PDF, DOCX, or TXT files", variant: "destructive" });
      return;
    }

    setSelectedFile(file);
    
    // Auto-fill title from filename
    if (!formData.title) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      setFormData(prev => ({ ...prev, title: nameWithoutExt }));
    }
  };

  const extractDocumentText = async (filePath: string, fileType: string): Promise<string> => {
    const { data, error } = await supabase.functions.invoke("extract-document-text", {
      body: { filePath, fileType },
    });
    
    if (error) throw error;
    return data?.text || "";
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }

    setSaving(true);
    
    try {
      let fileUrl = editingItem?.file_url || null;
      let fileName = editingItem?.file_name || null;
      let fileType = editingItem?.file_type || null;
      let content = formData.content;

      // Handle file upload
      if (selectedFile) {
        setUploading(true);
        const filePath = `${companyId}/${Date.now()}-${selectedFile.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from("company-documents")
          .upload(filePath, selectedFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("company-documents")
          .getPublicUrl(filePath);

        fileUrl = urlData?.publicUrl || null;
        fileName = selectedFile.name;
        fileType = selectedFile.type;

        // Extract text from document
        if (selectedFile.type !== "text/plain") {
          try {
            const extractedText = await extractDocumentText(filePath, selectedFile.type);
            if (extractedText) {
              content = extractedText;
            }
          } catch (err) {
            console.error("Text extraction failed:", err);
            // Continue without extracted text
          }
        } else {
          content = await selectedFile.text();
        }
        
        setUploading(false);
      }

      type DealStage = "prospecting" | "discovery" | "proposal" | "closing" | "follow_up";
      const validStages: DealStage[] = ["prospecting", "discovery", "proposal", "closing", "follow_up"];
      const stageValue = validStages.includes(formData.stage as DealStage) 
        ? (formData.stage as DealStage) 
        : null;

      const knowledgeData = {
        title: formData.title.trim(),
        content: content.trim() || "No content extracted",
        category: formData.category || null,
        stage: stageValue,
        tags: formData.tags ? formData.tags.split(",").map(t => t.trim()).filter(Boolean) : null,
        company_id: companyId,
        created_by: userId,
        file_url: fileUrl,
        file_name: fileName,
        file_type: fileType,
        is_active: true,
      };

      if (editingItem) {
        const { error } = await supabase
          .from("sales_knowledge")
          .update(knowledgeData)
          .eq("id", editingItem.id);

        if (error) throw error;
        toast({ title: "Knowledge updated successfully" });
      } else {
        const { error } = await supabase
          .from("sales_knowledge")
          .insert([knowledgeData]);

        if (error) throw error;
        toast({ title: "Knowledge added successfully" });
      }

      resetForm();
      setIsAddOpen(false);
      setIsEditOpen(false);
      fetchKnowledge();
    } catch (error) {
      console.error("Error saving knowledge:", error);
      toast({ title: "Failed to save", description: "Please try again", variant: "destructive" });
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  const handleEdit = (item: KnowledgeItem) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      content: item.content,
      category: item.category || "",
      stage: item.stage || "",
      tags: item.tags?.join(", ") || "",
    });
    setIsEditOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase
        .from("sales_knowledge")
        .delete()
        .eq("id", deleteId);

      if (error) throw error;
      toast({ title: "Knowledge deleted" });
      fetchKnowledge();
    } catch (error) {
      console.error("Error deleting:", error);
      toast({ title: "Failed to delete", variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  };

  const filteredKnowledge = knowledge.filter(item =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getCategoryIcon = (category: string | null) => {
    const cat = CATEGORIES.find(c => c.value === category);
    const Icon = cat?.icon || FileText;
    return <Icon className="h-4 w-4" />;
  };

  const getCategoryLabel = (category: string | null) => {
    const cat = CATEGORIES.find(c => c.value === category);
    return cat?.label || category || "Uncategorized";
  };

  const getStageColor = (stage: string | null) => {
    switch (stage) {
      case "prospecting": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "discovery": return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
      case "proposal": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
      case "closing": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "follow_up": return "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const FormContent = () => (
    <div className="space-y-4">
      {/* File Upload */}
      <div className="space-y-2">
        <Label>Upload Document (Optional)</Label>
        <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
          />
          <label htmlFor="file-upload" className="cursor-pointer">
            {selectedFile ? (
              <div className="flex items-center justify-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-500" />
                <span>{selectedFile.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    setSelectedFile(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <FileUp className="h-8 w-8" />
                <span className="text-sm">Drop PDF, DOCX, or TXT file here</span>
                <span className="text-xs">or click to browse</span>
              </div>
            )}
          </label>
        </div>
      </div>

      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          placeholder="e.g., Viking 73-97 Product Sheet"
        />
      </div>

      {/* Category & Stage */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Category</Label>
          <Select
            value={formData.category}
            onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Sales Stage</Label>
          <Select
            value={formData.stage}
            onValueChange={(value) => setFormData(prev => ({ ...prev, stage: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="All stages" />
            </SelectTrigger>
            <SelectContent>
              {STAGES.map(stage => (
                <SelectItem key={stage.value} value={stage.value}>
                  {stage.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-2">
        <Label htmlFor="content">Content</Label>
        <Textarea
          id="content"
          value={formData.content}
          onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
          placeholder="Paste product information, scripts, or objection handling tips..."
          rows={8}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          {selectedFile ? "Content will be auto-extracted from the uploaded document" : "Or manually enter content"}
        </p>
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <Label htmlFor="tags">Tags (comma-separated)</Label>
        <Input
          id="tags"
          value={formData.tags}
          onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
          placeholder="e.g., corn, non-gmo, tar-spot"
        />
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-2 pt-4">
        <Button
          variant="outline"
          onClick={() => {
            resetForm();
            setIsAddOpen(false);
            setIsEditOpen(false);
          }}
        >
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={saving || uploading}>
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : editingItem ? (
            "Update"
          ) : (
            "Add Knowledge"
          )}
        </Button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Sales Knowledge Base</h3>
          <p className="text-sm text-muted-foreground">
            Upload products, scripts, and training materials for Jericho to use
          </p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add Knowledge
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Sales Knowledge</DialogTitle>
              <DialogDescription>
                Upload documents or paste content that Jericho will use for recommendations
              </DialogDescription>
            </DialogHeader>
            <FormContent />
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search knowledge base..."
          className="pl-10"
        />
      </div>

      {/* Knowledge List */}
      <ScrollArea className="h-[400px]">
        {filteredKnowledge.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="font-medium">No knowledge added yet</p>
            <p className="text-sm text-muted-foreground">
              Upload product sheets, scripts, or paste training content
            </p>
          </div>
        ) : (
          <div className="space-y-3 pr-4">
            {filteredKnowledge.map((item) => (
              <Card key={item.id} className="group hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {getCategoryIcon(item.category)}
                        <h4 className="font-medium truncate">{item.title}</h4>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {item.content.substring(0, 150)}...
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {getCategoryLabel(item.category)}
                        </Badge>
                        {item.stage && (
                          <Badge className={`text-xs ${getStageColor(item.stage)}`}>
                            {STAGES.find(s => s.value === item.stage)?.label || item.stage}
                          </Badge>
                        )}
                        {item.file_name && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Upload className="h-3 w-3" />
                            {item.file_name}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(item)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Knowledge</DialogTitle>
            <DialogDescription>
              Update this knowledge item
            </DialogDescription>
          </DialogHeader>
          <FormContent />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Knowledge</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this item? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
