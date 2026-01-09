import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import jsPDF from "jspdf";

interface PrepDocumentPDFProps {
  document: {
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
    created_at?: string;
  };
}

export function PrepDocumentPDF({ document }: PrepDocumentPDFProps) {
  const generatePDF = () => {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let y = 20;

    // Helper to add wrapped text
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
    pdf.setFillColor(30, 41, 59); // slate-800
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

    // Meeting Overview Box
    pdf.setFillColor(248, 250, 252); // slate-50
    pdf.roundedRect(margin, y, contentWidth, 40, 3, 3, "F");
    
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text("MEETING OVERVIEW", margin + 5, y + 8);
    
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    y += 15;
    
    const leftCol = margin + 5;
    const rightCol = pageWidth / 2 + 5;
    
    pdf.text(`Prospect: ${document.prospect_name || "TBD"}`, leftCol, y);
    pdf.text(`Call Type: ${document.call_type || "TBD"}`, rightCol, y);
    y += 7;
    pdf.text(`Company: ${document.prospect_company || "TBD"}`, leftCol, y);
    pdf.text(`Role: ${document.prospect_role || "TBD"}`, rightCol, y);
    y += 7;
    pdf.text(`Prepared by: ${document.seller_name || "Sales Rep"}`, leftCol, y);
    
    y += 20;

    // Call Objective
    if (document.call_objective) {
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(30, 64, 175); // blue-800
      pdf.text("CALL OBJECTIVE", margin, y);
      y += 7;
      
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(10);
      addWrappedText(document.call_objective, margin, contentWidth);
      y += 8;
    }

    // Key Talking Points
    if (document.talking_points?.length) {
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(30, 64, 175);
      pdf.text("KEY TALKING POINTS", margin, y);
      y += 7;
      
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(10);
      
      document.talking_points.forEach((tp, i) => {
        if (y > 260) {
          pdf.addPage();
          y = 20;
        }
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
        if (y > 260) {
          pdf.addPage();
          y = 20;
        }
        pdf.setFont("helvetica", "bold");
        pdf.text(`Q${i + 1}:`, margin, y);
        pdf.setFont("helvetica", "normal");
        addWrappedText(q.question, margin + 12, contentWidth - 12);
        if (q.purpose) {
          pdf.setTextColor(100, 100, 100);
          pdf.setFontSize(9);
          addWrappedText(`Purpose: ${q.purpose}`, margin + 12, contentWidth - 12, 5);
          pdf.setTextColor(0, 0, 0);
          pdf.setFontSize(10);
        }
        y += 3;
      });
      y += 5;
    }

    // Product Recommendations
    if (document.product_recommendations?.length) {
      if (y > 240) {
        pdf.addPage();
        y = 20;
      }
      
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(30, 64, 175);
      pdf.text("RECOMMENDED SOLUTIONS", margin, y);
      y += 7;
      
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(10);
      
      document.product_recommendations.forEach((pr) => {
        if (y > 260) {
          pdf.addPage();
          y = 20;
        }
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

    // Objection Handlers
    if (document.objection_handlers?.length) {
      if (y > 220) {
        pdf.addPage();
        y = 20;
      }
      
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(30, 64, 175);
      pdf.text("OBJECTION HANDLING", margin, y);
      y += 7;
      
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(10);
      
      document.objection_handlers.forEach((oh) => {
        if (y > 250) {
          pdf.addPage();
          y = 20;
        }
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(180, 83, 9); // amber-700
        addWrappedText(`"${oh.objection}"`, margin, contentWidth);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(0, 0, 0);
        addWrappedText(`Response: ${oh.response}`, margin + 8, contentWidth - 8);
        y += 3;
      });
      y += 5;
    }

    // Next Steps
    if (document.next_steps) {
      if (y > 250) {
        pdf.addPage();
        y = 20;
      }
      
      pdf.setFillColor(236, 253, 245); // green-50
      pdf.roundedRect(margin, y, contentWidth, 25, 3, 3, "F");
      
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(22, 101, 52); // green-800
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

    // Save
    const filename = `${document.prospect_company || "Prospect"}_${document.call_type || "Call"}_Prep.pdf`.replace(/\s+/g, "_");
    pdf.save(filename);
  };

  return (
    <Button onClick={generatePDF} className="flex-1">
      <Download className="mr-2 h-4 w-4" />
      Download PDF
    </Button>
  );
}
