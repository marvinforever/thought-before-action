import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormattedMessage } from "@/components/ui/formatted-message";
import { 
  Package, ChevronDown, ChevronUp, ExternalLink, Save, Check, Building2, Loader2 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProductCatalogCardProps {
  companyName: string;
  catalog: string;
  citations?: string[];
  savedToCompany?: string;
  userCompanyId: string;
}

export function ProductCatalogCard({ 
  companyName, 
  catalog, 
  citations, 
  savedToCompany,
  userCompanyId 
}: ProductCatalogCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(!!savedToCompany);
  const [savedTo, setSavedTo] = useState(savedToCompany || "");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [loadedCompanies, setLoadedCompanies] = useState(false);
  const { toast } = useToast();

  const lines = catalog.split("\n").filter(Boolean);
  const previewLines = lines.slice(0, 5).join("\n");
  const hasMore = lines.length > 5;

  const loadCompanies = async () => {
    if (loadedCompanies) return;
    const { data } = await supabase
      .from("companies")
      .select("id, name")
      .order("name");
    setCompanies(data || []);
    setLoadedCompanies(true);
  };

  const handleSave = async () => {
    const targetId = selectedCompanyId || userCompanyId;
    if (!targetId) return;

    setSaving(true);
    try {
      const targetCompany = companies.find(c => c.id === targetId);
      const targetName = targetCompany?.name || "your company";

      const knowledgeContent = [
        `# ${companyName} — Product Catalog`,
        `*Auto-researched on ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}*\n`,
        catalog,
        citations && citations.length > 0 
          ? `\n## Sources\n${citations.map(c => `- ${c}`).join("\n")}` 
          : "",
      ].filter(Boolean).join("\n\n");

      const { error } = await supabase.from("company_knowledge").insert({
        company_id: targetId,
        title: `${companyName} — Product Catalog (Auto-Generated)`,
        content: knowledgeContent,
        document_type: "product_catalog",
        category: "product_catalog",
        is_active: true,
      });

      if (error) throw error;

      setSaved(true);
      setSavedTo(targetName);
      toast({
        title: "📦 Catalog Saved",
        description: `${companyName} product catalog saved to ${targetName}'s knowledge base`,
      });
    } catch (err) {
      toast({
        title: "Save failed",
        description: "Could not save to knowledge base. Try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mt-2 border-amber-500/30 bg-amber-500/5 overflow-hidden">
      <CardContent className="p-3 space-y-2">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-amber-500/10 flex items-center justify-center shrink-0">
              <Package className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wide">
              Product Catalog
            </span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
              <Building2 className="h-2.5 w-2.5 mr-0.5" />
              {companyName}
            </Badge>
          </div>
          {saved && (
            <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 text-[10px]">
              <Check className="h-2.5 w-2.5 mr-0.5" />
              Saved to {savedTo}
            </Badge>
          )}
        </div>

        {/* Catalog Preview */}
        <div className="text-sm">
          <FormattedMessage content={expanded ? catalog : previewLines} />
        </div>

        {/* Expand/Collapse */}
        <div className="flex items-center gap-2">
          {hasMore && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="gap-1 text-xs text-amber-700 dark:text-amber-400 hover:text-amber-800 h-7 px-2"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  See full catalog ({lines.length} lines)
                </>
              )}
            </Button>
          )}
        </div>

        {/* Save to Knowledge Base */}
        {!saved && (
          <div className="border-t border-amber-500/10 pt-2 flex items-center gap-2">
            <Select 
              onValueChange={setSelectedCompanyId}
              onOpenChange={(open) => { if (open) loadCompanies(); }}
            >
              <SelectTrigger className="h-8 text-xs flex-1 max-w-[200px]">
                <SelectValue placeholder="Save to company..." />
              </SelectTrigger>
              <SelectContent>
                {companies.map(c => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !selectedCompanyId}
              className="h-8 gap-1 text-xs bg-amber-600 hover:bg-amber-700 text-white"
            >
              {saving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Save className="h-3 w-3" />
              )}
              Save to Knowledge
            </Button>
          </div>
        )}

        {/* Citations */}
        <AnimatePresence>
          {expanded && citations && citations.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-amber-500/10 pt-2 space-y-1"
            >
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Sources</p>
              {citations.slice(0, 5).map((url, i) => {
                let displayUrl = url;
                try {
                  const parsed = new URL(url);
                  displayUrl = parsed.hostname.replace("www.", "");
                } catch {}
                return (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    <span className="truncate">{displayUrl}</span>
                  </a>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
