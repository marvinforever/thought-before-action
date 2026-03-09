import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ContactCSVImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onImportComplete: () => void;
}

interface ParsedRow {
  name: string;
  title: string;
  company: string;
  phone: string;
  email: string;
  last_purchase: string;
  notes: string;
}

const EXPECTED_FIELDS = ["name", "title", "company", "phone", "email", "last_purchase", "notes"];

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

function autoMapHeaders(csvHeaders: string[]): Record<number, string> {
  const mapping: Record<number, string> = {};
  const aliases: Record<string, string[]> = {
    name: ["name", "contact", "full name", "fullname", "contact name", "customer"],
    title: ["title", "job title", "position", "role"],
    company: ["company", "organization", "org", "business", "company name"],
    phone: ["phone", "telephone", "tel", "mobile", "cell"],
    email: ["email", "e-mail", "email address"],
    last_purchase: ["last purchase", "last_purchase", "last order", "last sale", "last_sale_date"],
    notes: ["notes", "note", "comments", "comment", "memo"],
  };

  csvHeaders.forEach((h, idx) => {
    const lower = h.toLowerCase().trim();
    for (const [field, names] of Object.entries(aliases)) {
      if (names.includes(lower)) {
        mapping[idx] = field;
        break;
      }
    }
  });
  return mapping;
}

export function ContactCSVImport({ open, onOpenChange, userId, onImportComplete }: ContactCSVImportProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "map" | "preview" | "importing">("upload");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [columnMap, setColumnMap] = useState<Record<number, string>>({});
  const [parsedContacts, setParsedContacts] = useState<ParsedRow[]>([]);
  const [importResult, setImportResult] = useState<{ success: number; errors: number } | null>(null);

  const reset = () => {
    setStep("upload");
    setCsvHeaders([]);
    setCsvRows([]);
    setColumnMap({});
    setParsedContacts([]);
    setImportResult(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { headers, rows } = parseCSV(text);
      if (headers.length === 0) {
        toast({ title: "Empty or invalid CSV file", variant: "destructive" });
        return;
      }
      setCsvHeaders(headers);
      setCsvRows(rows);
      setColumnMap(autoMapHeaders(headers));
      setStep("map");
    };
    reader.readAsText(file);
  };

  const handleMapConfirm = () => {
    const nameCol = Object.entries(columnMap).find(([, v]) => v === "name");
    if (!nameCol) {
      toast({ title: "Name column is required", variant: "destructive" });
      return;
    }

    const contacts: ParsedRow[] = csvRows
      .map(row => {
        const get = (field: string) => {
          const entry = Object.entries(columnMap).find(([, v]) => v === field);
          if (!entry) return "";
          return row[Number(entry[0])] || "";
        };
        return {
          name: get("name"),
          title: get("title"),
          company: get("company"),
          phone: get("phone"),
          email: get("email"),
          last_purchase: get("last_purchase"),
          notes: get("notes"),
        };
      })
      .filter(c => c.name.trim());

    setParsedContacts(contacts);
    setStep("preview");
  };

  const handleImport = async () => {
    setStep("importing");
    let success = 0;
    let errors = 0;

    // First, get or create companies
    const uniqueCompanyNames = [...new Set(parsedContacts.map(c => c.company.trim()).filter(Boolean))];
    const companyIdMap: Record<string, string> = {};

    if (uniqueCompanyNames.length > 0) {
      // Fetch existing companies
      const { data: existing } = await supabase
        .from("sales_companies")
        .select("id, name")
        .eq("profile_id", userId);

      const existingMap = new Map((existing || []).map(c => [c.name.toLowerCase(), c.id]));

      for (const name of uniqueCompanyNames) {
        const match = existingMap.get(name.toLowerCase());
        if (match) {
          companyIdMap[name.toLowerCase()] = match;
        } else {
          const { data: newCompany } = await supabase
            .from("sales_companies")
            .insert({ name, profile_id: userId })
            .select("id")
            .single();
          if (newCompany) {
            companyIdMap[name.toLowerCase()] = newCompany.id;
          }
        }
      }
    }

    // Batch insert contacts (50 at a time)
    const BATCH_SIZE = 50;
    for (let i = 0; i < parsedContacts.length; i += BATCH_SIZE) {
      const batch = parsedContacts.slice(i, i + BATCH_SIZE).map(c => ({
        name: c.name.trim(),
        title: c.title || null,
        company_id: c.company ? companyIdMap[c.company.toLowerCase()] || null : null,
        phone: c.phone || null,
        email: c.email || null,
        last_purchase_date: c.last_purchase ? parseDate(c.last_purchase) : null,
        notes: c.notes || null,
        profile_id: userId,
        pipeline_stage: "prospect",
      }));

      const { error } = await supabase.from("sales_contacts").insert(batch);
      if (error) {
        console.error("Batch insert error:", error);
        errors += batch.length;
      } else {
        success += batch.length;
      }
    }

    setImportResult({ success, errors });
    if (success > 0) {
      toast({ title: `✅ ${success} contacts imported successfully!` });
      onImportComplete();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Contacts from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file with your customer/prospect data. We'll map the columns and import them.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 py-4">
            <div
              className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">Click to upload CSV file</p>
              <p className="text-sm text-muted-foreground mt-1">
                Expected columns: Name, Title, Company, Phone, Email, Last Purchase, Notes
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={handleFileSelect}
            />

            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm font-medium mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" /> CSV Format Example
              </p>
              <pre className="text-xs text-muted-foreground overflow-x-auto">
{`Name,Title,Company,Phone,Email,Last Purchase,Notes
Bill Wallbrown,Operations Manager,Valley Ag,(555) 123-4567,bill@valleyag.com,2025-11-15,Key decision maker
Sarah Chen,Owner,Chen Farms,(555) 987-6543,sarah@chenf.com,2025-08-20,Prospect - interested in seed`}
              </pre>
            </div>
          </div>
        )}

        {step === "map" && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Found {csvRows.length} rows. Map your CSV columns to contact fields:
            </p>
            <div className="space-y-3">
              {csvHeaders.map((header, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className="text-sm font-medium min-w-[120px] truncate">{header}</span>
                  <span className="text-muted-foreground">→</span>
                  <Select
                    value={columnMap[idx] || "skip"}
                    onValueChange={(v) => setColumnMap(prev => {
                      const next = { ...prev };
                      if (v === "skip") delete next[idx];
                      else next[idx] = v;
                      return next;
                    })}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="skip">Skip</SelectItem>
                      {EXPECTED_FIELDS.map(f => (
                        <SelectItem key={f} value={f}>
                          {f.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep("upload")}>Back</Button>
              <Button onClick={handleMapConfirm}>Preview Import</Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Ready to import <strong>{parsedContacts.length}</strong> contacts:
            </p>
            <div className="border rounded-lg max-h-[300px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedContacts.slice(0, 20).map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.company || "-"}</TableCell>
                      <TableCell className="text-sm">{c.email || "-"}</TableCell>
                      <TableCell className="text-sm">{c.phone || "-"}</TableCell>
                    </TableRow>
                  ))}
                  {parsedContacts.length > 20 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground text-sm">
                        ...and {parsedContacts.length - 20} more
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep("map")}>Back</Button>
              <Button onClick={handleImport}>
                Import {parsedContacts.length} Contacts
              </Button>
            </div>
          </div>
        )}

        {step === "importing" && !importResult && (
          <div className="py-12 text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Importing contacts...</p>
          </div>
        )}

        {importResult && (
          <div className="py-8 text-center space-y-4">
            <CheckCircle2 className="h-10 w-10 mx-auto text-green-500" />
            <div>
              <p className="font-semibold text-lg">{importResult.success} contacts imported</p>
              {importResult.errors > 0 && (
                <p className="text-sm text-destructive flex items-center justify-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" /> {importResult.errors} failed
                </p>
              )}
            </div>
            <Button onClick={() => { reset(); onOpenChange(false); }}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function parseDate(val: string): string | null {
  if (!val?.trim()) return null;
  const s = val.trim();
  // ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // MM/DD/YYYY
  if (s.includes("/")) {
    const parts = s.split("/");
    if (parts.length === 3) {
      const m = parts[0].padStart(2, "0");
      const d = parts[1].padStart(2, "0");
      const y = parts[2].length === 2 ? "20" + parts[2] : parts[2];
      return `${y}-${m}-${d}`;
    }
  }
  return null;
}
