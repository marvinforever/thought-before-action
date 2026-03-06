import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Download, Loader2, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateIGPPdf } from "./igp-pdf-export";
import { IGPData } from "./igp-types";
import JSZip from "jszip";

interface Company {
  id: string;
  name: string;
}

export function BulkIGPExport() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [employees, setEmployees] = useState<Array<{ id: string; full_name: string }>>([]);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [results, setResults] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadCompanies();
  }, []);

  useEffect(() => {
    if (selectedCompanyId) {
      loadEmployees(selectedCompanyId);
    } else {
      setEmployees([]);
    }
    setResults(null);
  }, [selectedCompanyId]);

  const loadCompanies = async () => {
    const { data } = await supabase.from("companies").select("id, name").order("name");
    if (data) setCompanies(data);
  };

  const loadEmployees = async (companyId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("full_name");
    if (data) setEmployees(data);
  };

  const handleExportAll = async () => {
    if (!selectedCompanyId || employees.length === 0) return;

    setExporting(true);
    setProgress(0);
    setResults(null);

    const zip = new JSZip();
    const companyName = companies.find(c => c.id === selectedCompanyId)?.name || "company";
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];
      setStatusMessage(`Generating IGP for ${emp.full_name} (${i + 1}/${employees.length})...`);
      setProgress(Math.round(((i) / employees.length) * 100));

      try {
        const { data: result, error } = await supabase.functions.invoke(
          "generate-growth-plan-recommendations",
          { body: { profile_id: emp.id } }
        );

        if (error || !result?.success) {
          throw new Error(result?.error || error?.message || "Failed");
        }

        const igpData: IGPData = {
          ...result,
          generated_at: new Date().toISOString(),
        };

        const blob = generateIGPPdf(igpData, { returnBlob: true });
        if (blob) {
          const safeName = (emp.full_name || "employee").replace(/\s+/g, "-").toLowerCase();
          zip.file(`${safeName}-igp.pdf`, blob);
          success++;
        } else {
          throw new Error("PDF generation returned no data");
        }
      } catch (err: any) {
        failed++;
        errors.push(`${emp.full_name}: ${err.message}`);
        console.error(`IGP export failed for ${emp.full_name}:`, err);
      }
    }

    setProgress(100);
    setStatusMessage("Creating ZIP file...");

    try {
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${companyName.replace(/\s+/g, "-").toLowerCase()}-igp-export-${new Date().toISOString().split("T")[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Export Complete",
        description: `${success} IGPs exported${failed > 0 ? `, ${failed} failed` : ""}`,
      });
    } catch (err: any) {
      toast({ title: "ZIP creation failed", description: err.message, variant: "destructive" });
    }

    setResults({ success, failed, errors });
    setExporting(false);
    setStatusMessage("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-accent" />
          Bulk Growth Plan Export
        </CardTitle>
        <CardDescription>
          Generate Individual Growth Plans for all employees in a company and download as a ZIP of PDFs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
            <SelectTrigger className="w-full sm:w-[300px]">
              <SelectValue placeholder="Select a company" />
            </SelectTrigger>
            <SelectContent>
              {companies.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={handleExportAll}
            disabled={exporting || !selectedCompanyId || employees.length === 0}
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {exporting ? "Exporting..." : `Export All IGPs${employees.length > 0 ? ` (${employees.length})` : ""}`}
          </Button>
        </div>

        {selectedCompanyId && employees.length === 0 && (
          <p className="text-sm text-muted-foreground">No active employees found for this company.</p>
        )}

        {exporting && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground">{statusMessage}</p>
          </div>
        )}

        {results && (
          <div className="space-y-2 rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">{results.success} IGPs exported successfully</span>
            </div>
            {results.failed > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">{results.failed} failed</span>
                </div>
                <ul className="text-xs text-muted-foreground space-y-0.5 ml-6">
                  {results.errors.map((e, i) => (
                    <li key={i}>• {e}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
