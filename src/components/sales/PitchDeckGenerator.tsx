import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Presentation, Download, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PitchDeckGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId?: string | null;
  customerName?: string;
  companyId?: string;
  conversationContext?: string;
  productContext?: string;
}

interface DeckSlide {
  type: string;
  title: string;
  subtitle?: string;
  bulletPoints?: string[];
  note?: string;
  items?: { label: string; value: string; detail: string }[];
  products?: { name: string; description: string; benefit: string }[];
  steps?: { timing: string; action: string; product: string }[];
  callToAction?: string;
}

interface DeckData {
  title: string;
  subtitle: string;
  customerName: string;
  slides: DeckSlide[];
}

export function PitchDeckGenerator({
  open,
  onOpenChange,
  customerId,
  customerName: initialCustomerName,
  companyId,
  conversationContext,
  productContext,
}: PitchDeckGeneratorProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deck, setDeck] = useState<DeckData | null>(null);
  const [customerName, setCustomerName] = useState(initialCustomerName || "");
  const [productInfo, setProductInfo] = useState(productContext || "");

  const handleGenerate = async () => {
    if (!customerName.trim()) {
      toast({ title: "Enter a customer name", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-pitch-deck", {
        body: {
          customerId,
          customerName: customerName.trim(),
          productContext: productInfo || undefined,
          conversationContext,
          companyId,
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setDeck(data.deck);
      toast({ title: "Pitch deck generated!", description: "Preview it below and download as PowerPoint." });
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!deck) return;
    setDownloading(true);
    try {
      // Dynamically import pptxgenjs
      const PptxGenJS = (await import("pptxgenjs")).default;
      const pptx = new PptxGenJS();

      pptx.layout = "LAYOUT_WIDE";
      pptx.author = "Jericho Sales Agent";
      pptx.title = deck.title;

      const PRIMARY = "1E3A5F";
      const ACCENT = "2E8B57";
      const LIGHT_BG = "F0F4F8";
      const WHITE = "FFFFFF";
      const DARK_TEXT = "1A1A2E";
      const MUTED = "6B7280";

      for (const slide of deck.slides) {
        const s = pptx.addSlide();

        switch (slide.type) {
          case "intro": {
            s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: "100%", fill: { color: PRIMARY } });
            s.addText(slide.title, {
              x: 0.8, y: 1.5, w: 8, h: 1.5,
              fontSize: 36, fontFace: "Arial", bold: true, color: WHITE,
            });
            if (slide.subtitle) {
              s.addText(slide.subtitle, {
                x: 0.8, y: 3.0, w: 8, h: 0.8,
                fontSize: 20, fontFace: "Arial", color: "B0C4DE",
              });
            }
            if (slide.bulletPoints?.length) {
              s.addText(
                slide.bulletPoints.map(bp => ({ text: bp, options: { bullet: true, color: "D0E0F0" } })),
                { x: 0.8, y: 4.0, w: 8, h: 2, fontSize: 16, fontFace: "Arial", color: "D0E0F0" }
              );
            }
            s.addText(`Prepared for ${deck.customerName}`, {
              x: 0.8, y: 6.5, w: 8, h: 0.5,
              fontSize: 14, fontFace: "Arial", italic: true, color: "8FAABE",
            });
            break;
          }

          case "challenge":
          case "solution": {
            s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 1.2, fill: { color: PRIMARY } });
            s.addText(slide.title, {
              x: 0.8, y: 0.2, w: 10, h: 0.8,
              fontSize: 28, fontFace: "Arial", bold: true, color: WHITE,
            });
            if (slide.bulletPoints?.length) {
              s.addText(
                slide.bulletPoints.map(bp => ({
                  text: bp,
                  options: { bullet: { code: "2022" }, indentLevel: 0, color: DARK_TEXT },
                })),
                {
                  x: 0.8, y: 1.6, w: 10, h: 4.5,
                  fontSize: 18, fontFace: "Arial", color: DARK_TEXT,
                  paraSpaceAfter: 12,
                }
              );
            }
            if (slide.note) {
              s.addText(slide.note, {
                x: 0.8, y: 6.2, w: 10, h: 0.5,
                fontSize: 12, fontFace: "Arial", italic: true, color: MUTED,
              });
            }
            break;
          }

          case "benefits": {
            s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 1.2, fill: { color: ACCENT } });
            s.addText(slide.title, {
              x: 0.8, y: 0.2, w: 10, h: 0.8,
              fontSize: 28, fontFace: "Arial", bold: true, color: WHITE,
            });
            const items = slide.items || [];
            const colW = 3.2;
            items.forEach((item, i) => {
              const xPos = 0.8 + i * (colW + 0.4);
              // Card background
              s.addShape(pptx.ShapeType.roundRect, {
                x: xPos, y: 1.6, w: colW, h: 3.5,
                fill: { color: LIGHT_BG }, rectRadius: 0.15,
              });
              s.addText(item.value, {
                x: xPos, y: 1.9, w: colW, h: 0.8,
                fontSize: 32, fontFace: "Arial", bold: true, color: ACCENT, align: "center",
              });
              s.addText(item.label, {
                x: xPos, y: 2.7, w: colW, h: 0.5,
                fontSize: 16, fontFace: "Arial", bold: true, color: DARK_TEXT, align: "center",
              });
              s.addText(item.detail, {
                x: xPos + 0.2, y: 3.3, w: colW - 0.4, h: 1.5,
                fontSize: 13, fontFace: "Arial", color: MUTED, align: "center",
              });
            });
            break;
          }

          case "products": {
            s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 1.2, fill: { color: PRIMARY } });
            s.addText(slide.title, {
              x: 0.8, y: 0.2, w: 10, h: 0.8,
              fontSize: 28, fontFace: "Arial", bold: true, color: WHITE,
            });
            const products = slide.products || [];
            products.forEach((prod, i) => {
              const yPos = 1.6 + i * 1.4;
              s.addShape(pptx.ShapeType.roundRect, {
                x: 0.8, y: yPos, w: 11, h: 1.2,
                fill: { color: i % 2 === 0 ? LIGHT_BG : WHITE }, rectRadius: 0.1,
              });
              s.addText(prod.name, {
                x: 1.0, y: yPos + 0.1, w: 3, h: 0.5,
                fontSize: 16, fontFace: "Arial", bold: true, color: PRIMARY,
              });
              s.addText(prod.description, {
                x: 4.2, y: yPos + 0.1, w: 4, h: 0.5,
                fontSize: 13, fontFace: "Arial", color: DARK_TEXT,
              });
              s.addText(prod.benefit, {
                x: 1.0, y: yPos + 0.6, w: 10.5, h: 0.5,
                fontSize: 12, fontFace: "Arial", italic: true, color: ACCENT,
              });
            });
            break;
          }

          case "timeline": {
            s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 1.2, fill: { color: PRIMARY } });
            s.addText(slide.title, {
              x: 0.8, y: 0.2, w: 10, h: 0.8,
              fontSize: 28, fontFace: "Arial", bold: true, color: WHITE,
            });
            const steps = slide.steps || [];
            const stepW = 10.5 / Math.max(steps.length, 1);
            steps.forEach((step, i) => {
              const xPos = 0.8 + i * stepW;
              // Circle with number
              s.addShape(pptx.ShapeType.ellipse, {
                x: xPos + stepW / 2 - 0.3, y: 1.8, w: 0.6, h: 0.6,
                fill: { color: ACCENT },
              });
              s.addText(`${i + 1}`, {
                x: xPos + stepW / 2 - 0.3, y: 1.8, w: 0.6, h: 0.6,
                fontSize: 18, fontFace: "Arial", bold: true, color: WHITE, align: "center", valign: "middle",
              });
              s.addText(step.timing, {
                x: xPos, y: 2.6, w: stepW, h: 0.5,
                fontSize: 14, fontFace: "Arial", bold: true, color: DARK_TEXT, align: "center",
              });
              s.addText(step.action, {
                x: xPos + 0.1, y: 3.2, w: stepW - 0.2, h: 1.2,
                fontSize: 12, fontFace: "Arial", color: MUTED, align: "center",
              });
              if (step.product) {
                s.addText(step.product, {
                  x: xPos + 0.1, y: 4.5, w: stepW - 0.2, h: 0.5,
                  fontSize: 11, fontFace: "Arial", italic: true, color: ACCENT, align: "center",
                });
              }
            });
            break;
          }

          case "closing": {
            s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: "100%", fill: { color: PRIMARY } });
            s.addText(slide.title, {
              x: 0.8, y: 1.0, w: 10, h: 1,
              fontSize: 32, fontFace: "Arial", bold: true, color: WHITE,
            });
            if (slide.bulletPoints?.length) {
              s.addText(
                slide.bulletPoints.map(bp => ({ text: bp, options: { bullet: true, color: "D0E0F0" } })),
                { x: 0.8, y: 2.5, w: 8, h: 3, fontSize: 18, fontFace: "Arial", color: "D0E0F0", paraSpaceAfter: 10 }
              );
            }
            if (slide.callToAction) {
              s.addShape(pptx.ShapeType.roundRect, {
                x: 3.5, y: 5.8, w: 6, h: 0.8,
                fill: { color: ACCENT }, rectRadius: 0.1,
              });
              s.addText(slide.callToAction, {
                x: 3.5, y: 5.8, w: 6, h: 0.8,
                fontSize: 18, fontFace: "Arial", bold: true, color: WHITE, align: "center", valign: "middle",
              });
            }
            break;
          }

          default: {
            s.addText(slide.title, {
              x: 0.8, y: 0.5, w: 10, h: 1,
              fontSize: 28, fontFace: "Arial", bold: true, color: DARK_TEXT,
            });
            if (slide.bulletPoints?.length) {
              s.addText(
                slide.bulletPoints.map(bp => ({ text: bp, options: { bullet: true } })),
                { x: 0.8, y: 1.8, w: 10, h: 5, fontSize: 16, fontFace: "Arial", color: DARK_TEXT }
              );
            }
          }
        }
      }

      const fileName = `${deck.customerName.replace(/\s+/g, "_")}_Pitch_Deck.pptx`;
      await pptx.writeFile({ fileName });
      toast({ title: "Downloaded!", description: `${fileName} saved to your device.` });
    } catch (err: any) {
      console.error("PPTX generation error:", err);
      toast({ title: "Download failed", description: err.message, variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const handleClose = () => {
    setDeck(null);
    onOpenChange(false);
  };

  // Sync prop changes
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setCustomerName(initialCustomerName || "");
      setProductInfo(productContext || "");
      setDeck(null);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Presentation className="h-5 w-5" />
            {loading ? "Generating Pitch Deck..." : deck ? "Your Pitch Deck" : "Create Product Pitch Deck"}
          </DialogTitle>
          <DialogDescription>
            {loading
              ? "Analyzing customer data and building your presentation..."
              : deck
                ? "Preview your slides below and download as PowerPoint."
                : "Generate a tailored product presentation for your customer."}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground">Building your pitch deck...</p>
          </div>
        ) : deck ? (
          <div className="space-y-4 py-4">
            {/* Deck Preview */}
            <div className="border rounded-lg bg-muted/50 overflow-hidden">
              <div className="bg-primary p-4 text-primary-foreground">
                <h3 className="font-bold text-lg">{deck.title}</h3>
                <p className="text-sm opacity-80">{deck.subtitle}</p>
                <p className="text-xs opacity-60 mt-1">For {deck.customerName}</p>
              </div>
              <div className="p-4 space-y-3">
                {deck.slides.map((slide, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <span className="bg-primary/10 text-primary font-bold rounded-full w-6 h-6 flex items-center justify-center shrink-0 text-xs">
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-medium">{slide.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">{slide.type} slide</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={handleDownload} disabled={downloading} className="flex-1">
                {downloading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Download PowerPoint
              </Button>
              <Button variant="outline" onClick={() => { setDeck(null); }} className="flex-1">
                <Sparkles className="mr-2 h-4 w-4" />
                Regenerate
              </Button>
            </div>
            <Button variant="ghost" onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Customer / Grower Name</label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g., Ron Kiefer"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Product Focus <span className="text-muted-foreground">(optional)</span></label>
              <Textarea
                value={productInfo}
                onChange={(e) => setProductInfo(e.target.value)}
                placeholder="e.g., Pre-emerge herbicide program for corn, fungicide ROI discussion..."
                rows={3}
              />
            </div>
            <Button onClick={handleGenerate} className="w-full" disabled={!customerName.trim()}>
              <Presentation className="mr-2 h-4 w-4" />
              Generate Pitch Deck
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
