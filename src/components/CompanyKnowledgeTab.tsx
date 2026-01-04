import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Trash2, Plus, Search, BookOpen, FileQuestion, ScrollText, HelpCircle, Pencil, Globe } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface KnowledgeDoc {
  id: string;
  title: string;
  content: string | null;
  document_type: string;
  category: string | null;
  file_url: string | null;
  file_name: string | null;
  is_active: boolean;
  is_global: boolean;
  created_at: string;
  company_id: string;
}

const DOCUMENT_TYPES = [
  { value: "policy", label: "Policy", icon: ScrollText },
  { value: "procedure", label: "Procedure", icon: BookOpen },
  { value: "handbook", label: "Handbook", icon: FileText },
  { value: "faq", label: "FAQ", icon: HelpCircle },
  { value: "other", label: "Other", icon: FileQuestion },
];

const CATEGORIES = [
  "HR",
  "Finance",
  "Operations",
  "IT",
  "Legal",
  "Benefits",
  "Safety",
  "Training",
  "Other",
];

export default function CompanyKnowledgeTab() {
  const [documents, setDocuments] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<KnowledgeDoc | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [userCompanyId, setUserCompanyId] = useState<string | null>(null);
  const { toast } = useToast();

  // Form state
  const [newDoc, setNewDoc] = useState({
    title: "",
    content: "",
    document_type: "policy",
    category: "HR",
    is_global: false,
  });
  const [editDoc, setEditDoc] = useState({
    title: "",
    content: "",
    document_type: "policy",
    category: "HR",
    is_global: false,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    loadDocuments();
    checkSuperAdmin();
  }, []);

  const checkSuperAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_super_admin, company_id")
      .eq("id", user.id)
      .single();
    
    setIsSuperAdmin(profile?.is_super_admin || false);
    setUserCompanyId(profile?.company_id || null);
  };

  const loadDocuments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id, is_super_admin")
        .eq("id", user.id)
        .single();
      
      // Super admins see all docs (global + their company)
      // Regular admins see only their company's docs + global docs
      const { data, error } = await supabase
        .from("company_knowledge")
        .select("*")
        .or(profile?.is_super_admin 
          ? `is_global.eq.true,company_id.eq.${profile.company_id}`
          : `company_id.eq.${profile?.company_id},is_global.eq.true`)
        .order("is_global", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error("Error loading documents:", error);
      toast({
        title: "Error",
        description: "Failed to load knowledge base",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Maximum file size is 10MB",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
      // Auto-fill title from filename if empty
      if (!newDoc.title) {
        setNewDoc(prev => ({
          ...prev,
          title: file.name.replace(/\.[^/.]+$/, ""),
        }));
      }
    }
  };

  const handleAddDocument = async () => {
    if (!newDoc.title.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a document title",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (!profile?.company_id) throw new Error("No company found");

      let fileUrl = null;
      let fileName = null;
      let fileType = null;

      // Upload file if selected
      if (selectedFile) {
        const filePath = `${profile.company_id}/${Date.now()}-${selectedFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("company-documents")
          .upload(filePath, selectedFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("company-documents")
          .getPublicUrl(filePath);

        fileUrl = urlData.publicUrl;
        fileName = selectedFile.name;
        fileType = selectedFile.name.split(".").pop()?.toLowerCase();
      }

      // Insert document record
      const { error: insertError } = await supabase
        .from("company_knowledge")
        .insert({
          company_id: profile.company_id,
          title: newDoc.title.trim(),
          content: newDoc.content.trim() || null,
          document_type: newDoc.document_type,
          category: newDoc.category,
          file_url: fileUrl,
          file_name: fileName,
          file_type: fileType,
          uploaded_by: user.id,
          is_global: newDoc.is_global,
        });

      if (insertError) throw insertError;

      toast({
        title: "Document added",
        description: "Knowledge base updated successfully",
      });

      setIsAddOpen(false);
      setNewDoc({ title: "", content: "", document_type: "policy", category: "HR", is_global: false });
      setSelectedFile(null);
      loadDocuments();
    } catch (error) {
      console.error("Error adding document:", error);
      toast({
        title: "Error",
        description: "Failed to add document",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: KnowledgeDoc) => {
    if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;

    try {
      // Delete file from storage if exists
      if (doc.file_url) {
        const path = doc.file_url.split("/company-documents/")[1];
        if (path) {
          await supabase.storage.from("company-documents").remove([path]);
        }
      }

      const { error } = await supabase
        .from("company_knowledge")
        .delete()
        .eq("id", doc.id);

      if (error) throw error;

      toast({ title: "Document deleted", description: "Jericho will no longer reference this document." });
      loadDocuments();
    } catch (error) {
      console.error("Error deleting:", error);
      toast({
        title: "Error",
        description: "Failed to delete document",
        variant: "destructive",
      });
    }
  };

  const handleEditOpen = (doc: KnowledgeDoc) => {
    setEditingDoc(doc);
    setEditDoc({
      title: doc.title,
      content: doc.content || "",
      document_type: doc.document_type,
      category: doc.category || "HR",
      is_global: doc.is_global || false,
    });
    setIsEditOpen(true);
  };

  const handleUpdateDocument = async () => {
    if (!editingDoc || !editDoc.title.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a document title",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const { error } = await supabase
        .from("company_knowledge")
        .update({
          title: editDoc.title.trim(),
          content: editDoc.content.trim() || null,
          document_type: editDoc.document_type,
          category: editDoc.category,
          is_global: editDoc.is_global,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingDoc.id);

      if (error) throw error;

      toast({
        title: "Document updated",
        description: "Jericho will now use the updated information when answering questions.",
      });

      setIsEditOpen(false);
      setEditingDoc(null);
      loadDocuments();
    } catch (error) {
      console.error("Error updating document:", error);
      toast({
        title: "Error",
        description: "Failed to update document",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const filteredDocs = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.content?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTypeIcon = (type: string) => {
    const docType = DOCUMENT_TYPES.find(t => t.value === type);
    const Icon = docType?.icon || FileText;
    return <Icon className="h-4 w-4" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Company Knowledge Base</h2>
          <p className="text-muted-foreground">
            Upload policies, procedures, and FAQs. Jericho will use this to answer employee questions.
          </p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Document
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Knowledge Document</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <label className="text-sm font-medium">Title *</label>
                <Input
                  value={newDoc.title}
                  onChange={(e) => setNewDoc(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., PTO Policy 2024"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Type</label>
                  <Select
                    value={newDoc.document_type}
                    onValueChange={(v) => setNewDoc(prev => ({ ...prev, document_type: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Category</label>
                  <Select
                    value={newDoc.category}
                    onValueChange={(v) => setNewDoc(prev => ({ ...prev, category: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Content</label>
                <Textarea
                  value={newDoc.content}
                  onChange={(e) => setNewDoc(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Paste policy text here, or upload a file below..."
                  rows={6}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Jericho searches this text when employees ask questions.
                </p>
              </div>

              <div>
                <label className="text-sm font-medium">Upload File (optional)</label>
                <div className="mt-1 flex items-center gap-2">
                  <Input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.md"
                    onChange={handleFileChange}
                    className="flex-1"
                  />
                </div>
                {selectedFile && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Selected: {selectedFile.name}
                  </p>
                )}
              </div>

              {/* Global toggle - super admins only */}
              {isSuperAdmin && (
                <div className="flex items-center justify-between p-3 rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-amber-600" />
                    <div>
                      <p className="text-sm font-medium">Make Universal</p>
                      <p className="text-xs text-muted-foreground">
                        All clients will see this in their coaching sessions
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={newDoc.is_global}
                    onCheckedChange={(checked) => setNewDoc(prev => ({ ...prev, is_global: checked }))}
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddDocument} disabled={uploading}>
                  {uploading ? (
                    <>
                      <Upload className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Document
                    </>
                  )}
                </Button>
              </div>
            </div>
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
          className="pl-9"
        />
      </div>

      {/* Documents List */}
      {filteredDocs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium text-lg">No documents yet</h3>
            <p className="text-muted-foreground mb-4">
              Add your first policy, procedure, or FAQ
            </p>
            <Button onClick={() => setIsAddOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Document
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredDocs.map((doc) => (
            <Card key={doc.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      {getTypeIcon(doc.document_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{doc.title}</h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {doc.is_global && (
                          <Badge className="text-xs bg-amber-500 hover:bg-amber-600">
                            <Globe className="h-3 w-3 mr-1" />
                            Universal
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-xs">
                          {DOCUMENT_TYPES.find(t => t.value === doc.document_type)?.label || doc.document_type}
                        </Badge>
                        {doc.category && (
                          <Badge variant="outline" className="text-xs">
                            {doc.category}
                          </Badge>
                        )}
                        {doc.file_name && (
                          <span className="text-xs text-muted-foreground">
                            📎 {doc.file_name}
                          </span>
                        )}
                      </div>
                      {doc.content && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {doc.content}
                        </p>
                      )}
                    </div>
                  </div>
                  {/* Only show edit/delete for own company docs or super admins */}
                  {(isSuperAdmin || doc.company_id === userCompanyId) && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditOpen(doc)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(doc)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium">Title *</label>
              <Input
                value={editDoc.title}
                onChange={(e) => setEditDoc(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., PTO Policy 2024"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Type</label>
                <Select
                  value={editDoc.document_type}
                  onValueChange={(v) => setEditDoc(prev => ({ ...prev, document_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Category</label>
                <Select
                  value={editDoc.category}
                  onValueChange={(v) => setEditDoc(prev => ({ ...prev, category: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Content</label>
              <Textarea
                value={editDoc.content}
                onChange={(e) => setEditDoc(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Paste policy text here..."
                rows={8}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Update this text to change what Jericho knows. Changes take effect immediately.
              </p>
            </div>

            {/* Global toggle - super admins only */}
            {isSuperAdmin && (
              <div className="flex items-center justify-between p-3 rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-amber-600" />
                  <div>
                    <p className="text-sm font-medium">Make Universal</p>
                    <p className="text-xs text-muted-foreground">
                      All clients will see this in their coaching sessions
                    </p>
                  </div>
                </div>
                <Switch
                  checked={editDoc.is_global}
                  onCheckedChange={(checked) => setEditDoc(prev => ({ ...prev, is_global: checked }))}
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateDocument} disabled={uploading}>
                {uploading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Info box */}
      <Card className="bg-muted/50 border-dashed">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <BookOpen className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium">How it works</h4>
              <p className="text-sm text-muted-foreground">
                When employees ask Jericho questions like "What's our PTO policy?" or 
                "How do I submit an expense report?", Jericho will search your knowledge 
                base and answer using your company's specific policies.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                <strong>Tip:</strong> When policies change, just edit or replace the document here. 
                Jericho will automatically use the updated information in all future conversations.
              </p>
              {isSuperAdmin && (
                <p className="text-sm text-amber-600 mt-2">
                  <strong>🌐 Universal Documents:</strong> As a super admin, you can mark documents as 
                  "Universal" to make them available to all clients during their coaching sessions.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
