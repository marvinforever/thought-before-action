import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Link2, Download, Check, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";

interface PrepDocumentGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationContext: string;
  deal?: any;
}

interface PrepDocument {
  id: string;
  title: string;
  company_name?: string;
  company_logo?: string;
  seller_name?: string;
  seller_title?: string;
  prospect_name?: string;
  prospect_company?: string;
  prospect_role?: string;
  call_type?: string;
  call_objective?: string;
  talking_points?: Array<{ point: string; detail: string }>;
  discovery_questions?: Array<{ question: string; purpose: string }>;
  product_recommendations?: Array<{ product: string; value_prop: string }>;
  objection_handlers?: Array<{ objection: string; response: string }>;
  next_steps?: string;
  share_token: string;
  is_public: boolean;
  created_at: string;
}

export function PrepDocumentGenerator({ open, onOpenChange, conversationContext, deal }: PrepDocumentGeneratorProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [document, setDocument] = useState<PrepDocument | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-prep-document", {
        body: {
          dealId: deal?.id,
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to generate document";
      toast({
        title: "Generation Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = () => {
    if (!document) return;
    
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let y = 20;

    const addWrappedText = (text: string, x: number, maxWidth: number, lineHeight: number = 6) => {
      const lines = pdf.splitTextToSize(text, maxWidth);
      lines.forEach((line: string) => {
        if (y > 270) {
          pdf.addPage();
          y = 20;
        }
        pdf.text(line, x, y);
        y += lineHeight;
      });
    };

    // Header
    pdf.setFillColor(30, 41, 59);
    pdf.rect(0, 0, pageWidth, 40, "F");
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(20);
    pdf.setFont("helvetica", "bold");
    pdf.text(document.title || "Sales Prep Document", margin, 25);
    
    if (document.company_name) {
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      pdf.text(document.company_name, margin, 35);
    }

    y = 55;
    pdf.setTextColor(0, 0, 0);

    // Meeting Overview
    pdf.setFillColor(248, 250, 252);
    pdf.roundedRect(margin, y, contentWidth, 30, 3, 3, "F");
    
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text("MEETING OVERVIEW", margin + 5, y + 8);
    
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    y += 15;
    
    pdf.text(`Prospect: ${document.prospect_name || "TBD"}`, margin + 5, y);
    pdf.text(`Company: ${document.prospect_company || "TBD"}`, pageWidth / 2 + 5, y);
    y += 7;
    pdf.text(`Prepared by: ${document.seller_name || "Sales Rep"}`, margin + 5, y);
    
    y += 20;

    // Talking Points
    if (document.talking_points?.length) {
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(30, 64, 175);
      pdf.text("KEY TALKING POINTS", margin, y);
      y += 7;
      
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(10);
      
      document.talking_points.forEach((tp, i) => {
        if (y > 260) { pdf.addPage(); y = 20; }
        pdf.setFont("helvetica", "bold");
        pdf.text(`${i + 1}.`, margin, y);
        pdf.setFont("helvetica", "normal");
        addWrappedText(tp.point, margin + 8, contentWidth - 8);
        if (tp.detail) {
          pdf.setTextColor(100, 100, 100);
          pdf.setFontSize(9);
          addWrappedText(`→ ${tp.detail}`, margin + 12, contentWidth - 12, 5);
          pdf.setTextColor(0, 0, 0);
          pdf.setFontSize(10);
        }
        y += 3;
      });
      y += 5;
    }

    // Discovery Questions
    if (document.discovery_questions?.length) {
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(30, 64, 175);
      pdf.text("DISCOVERY QUESTIONS", margin, y);
      y += 7;
      
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(10);
      
      document.discovery_questions.forEach((q, i) => {
        if (y > 260) { pdf.addPage(); y = 20; }
        pdf.setFont("helvetica", "bold");
        pdf.text(`Q${i + 1}:`, margin, y);
        pdf.setFont("helvetica", "normal");
        addWrappedText(q.question, margin + 12, contentWidth - 12);
        y += 3;
      });
      y += 5;
    }

    // Product Recommendations
    if (document.product_recommendations?.length) {
      if (y > 240) { pdf.addPage(); y = 20; }
      
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(30, 64, 175);
      pdf.text("RECOMMENDED SOLUTIONS", margin, y);
      y += 7;
      
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(10);
      
      document.product_recommendations.forEach((pr) => {
        if (y > 260) { pdf.addPage(); y = 20; }
        pdf.setFont("helvetica", "bold");
        addWrappedText(`• ${pr.product}`, margin, contentWidth);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(100, 100, 100);
        pdf.setFontSize(9);
        addWrappedText(pr.value_prop, margin + 8, contentWidth - 8, 5);
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(10);
        y += 2;
      });
      y += 5;
    }

    // Next Steps
    if (document.next_steps) {
      if (y > 250) { pdf.addPage(); y = 20; }
      
      pdf.setFillColor(236, 253, 245);
      pdf.roundedRect(margin, y, contentWidth, 25, 3, 3, "F");
      
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(22, 101, 52);
      pdf.text("NEXT STEPS", margin + 5, y + 8);
      
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(10);
      y += 15;
      addWrappedText(document.next_steps, margin + 5, contentWidth - 10);
    }

    // Footer
    const footerY = pdf.internal.pageSize.getHeight() - 10;
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(
      `Generated ${new Date(document.created_at || Date.now()).toLocaleDateString()} | ${document.company_name || "Sales Prep"}`,
      margin,
      footerY
    );

    const filename = `${document.prospect_company || "Prospect"}_Prep.pdf`.replace(/\s+/g, "_");
    pdf.save(filename);
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create link";
      toast({
        title: "Error",
        description: errorMessage,
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
    onOpenChange(false);
  };

  // Auto-generate when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && !document && !loading) {
      handleGenerate();
    }
    if (!isOpen) {
      handleClose();
    } else {
      onOpenChange(isOpen);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {loading ? "Generating Prep Document..." : document ? "Your Prep Document" : "Generate Prep Document"}
          </DialogTitle>
          <DialogDescription>
            {loading 
              ? "Analyzing your conversation and creating a professional prep document..."
              : document 
                ? "Download as PDF or create a shareable link for your prospect."
                : "Create a document from your conversation."
            }
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground">Extracting recommendations from your conversation...</p>
          </div>
        ) : document ? (
          <div className="space-y-4 py-4">
            {/* Document Preview */}
            <div className="border rounded-lg p-4 bg-muted/50 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{document.title}</h3>
                  {(document.prospect_name || document.prospect_company) && (
                    <p className="text-sm text-muted-foreground">
                      {document.prospect_name && `${document.prospect_name} `}
                      {document.prospect_company && `at ${document.prospect_company}`}
                    </p>
                  )}
                </div>
              </div>

              {document.talking_points && document.talking_points.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Key Talking Points</h4>
                  <ul className="space-y-1 text-sm">
                    {document.talking_points.slice(0, 3).map((tp, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>{tp.point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {document.product_recommendations && document.product_recommendations.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Recommendations</h4>
                  <ul className="space-y-1 text-sm">
                    {document.product_recommendations.slice(0, 3).map((pr, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-primary">✓</span>
                        <span><strong>{pr.product}:</strong> {pr.value_prop}</span>
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
              <Button onClick={generatePDF} className="flex-1">
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </Button>
              
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
        ) : (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <Button onClick={handleGenerate}>
              <FileText className="mr-2 h-4 w-4" />
              Generate Document
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
