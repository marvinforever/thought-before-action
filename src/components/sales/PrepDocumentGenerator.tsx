import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileText, Link2, Download, Check, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PrepDocumentPDF } from "./PrepDocumentPDF";

interface PrepDocumentGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal?: any;
  conversationContext?: string;
}

export function PrepDocumentGenerator({ open, onOpenChange, deal, conversationContext }: PrepDocumentGeneratorProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [document, setDocument] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  
  const [formData, setFormData] = useState({
    callType: deal?.stage === "discovery" ? "Discovery Call" : deal?.stage === "demo" ? "Product Demo" : "Follow-up Call",
    callObjective: "",
    prospectName: deal?.sales_contacts?.[0]?.name || "",
    prospectCompany: deal?.sales_companies?.name || "",
    prospectRole: deal?.sales_contacts?.[0]?.role || "",
  });

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-prep-document", {
        body: {
          dealId: deal?.id,
          ...formData,
          conversationContext,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setDocument(data.document);
      toast({
        title: "Document Generated!",
        description: "Your sales prep document is ready.",
      });
    } catch (error: any) {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMakePublic = async () => {
    if (!document) return;
    
    try {
      const { error } = await supabase
        .from("sales_prep_documents")
        .update({ is_public: true })
        .eq("id", document.id);

      if (error) throw error;

      setDocument({ ...document, is_public: true });
      toast({
        title: "Link Created",
        description: "Your document is now shareable.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const copyShareLink = () => {
    if (!document) return;
    const url = `${window.location.origin}/prep/${document.share_token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Link Copied!",
      description: "Share link copied to clipboard.",
    });
  };

  const handleClose = () => {
    setDocument(null);
    setFormData({
      callType: "Discovery Call",
      callObjective: "",
      prospectName: "",
      prospectCompany: "",
      prospectRole: "",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {document ? "Your Prep Document" : "Generate Sales Prep Document"}
          </DialogTitle>
          <DialogDescription>
            {document 
              ? "Download as PDF or create a shareable link for your prospect."
              : "Create a professional, branded prep document you can download or share."
            }
          </DialogDescription>
        </DialogHeader>

        {!document ? (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="callType">Call Type</Label>
                <Select
                  value={formData.callType}
                  onValueChange={(v) => setFormData({ ...formData, callType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Discovery Call">Discovery Call</SelectItem>
                    <SelectItem value="Product Demo">Product Demo</SelectItem>
                    <SelectItem value="Follow-up Call">Follow-up Call</SelectItem>
                    <SelectItem value="Negotiation">Negotiation</SelectItem>
                    <SelectItem value="Closing Call">Closing Call</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="prospectRole">Prospect Role</Label>
                <Input
                  id="prospectRole"
                  placeholder="e.g., VP of Operations"
                  value={formData.prospectRole}
                  onChange={(e) => setFormData({ ...formData, prospectRole: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prospectName">Prospect Name</Label>
                <Input
                  id="prospectName"
                  placeholder="e.g., John Smith"
                  value={formData.prospectName}
                  onChange={(e) => setFormData({ ...formData, prospectName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prospectCompany">Prospect Company</Label>
                <Input
                  id="prospectCompany"
                  placeholder="e.g., Acme Corp"
                  value={formData.prospectCompany}
                  onChange={(e) => setFormData({ ...formData, prospectCompany: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="callObjective">Call Objective</Label>
              <Textarea
                id="callObjective"
                placeholder="What do you want to accomplish in this call?"
                value={formData.callObjective}
                onChange={(e) => setFormData({ ...formData, callObjective: e.target.value })}
                rows={2}
              />
            </div>

            <Button onClick={handleGenerate} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Document...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Generate Prep Document
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Document Preview */}
            <div className="border rounded-lg p-4 bg-muted/50 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{document.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {formData.prospectName} at {formData.prospectCompany}
                  </p>
                </div>
              </div>

              {document.talking_points?.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Key Talking Points</h4>
                  <ul className="space-y-1 text-sm">
                    {document.talking_points.slice(0, 3).map((tp: any, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>{tp.point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {document.discovery_questions?.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Discovery Questions</h4>
                  <ul className="space-y-1 text-sm">
                    {document.discovery_questions.slice(0, 3).map((q: any, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-primary">{i + 1}.</span>
                        <span>{q.question}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-xs text-muted-foreground italic">
                + more content in full document...
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2">
              <PrepDocumentPDF document={document} />
              
              {!document.is_public ? (
                <Button variant="outline" onClick={handleMakePublic} className="flex-1">
                  <Link2 className="mr-2 h-4 w-4" />
                  Create Shareable Link
                </Button>
              ) : (
                <Button variant="outline" onClick={copyShareLink} className="flex-1">
                  {copied ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy Share Link
                    </>
                  )}
                </Button>
              )}
            </div>

            <Button variant="ghost" onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
