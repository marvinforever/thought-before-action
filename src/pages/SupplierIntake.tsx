import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, FileSpreadsheet, FileText, Upload, Download } from "lucide-react";

const ACCEPTED =
  ".csv,.xlsx,.xls,.numbers,.tsv,.pdf,application/pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MAX_BYTES = 25 * 1024 * 1024; // 25MB per file
const MAX_FILES = 50;

const TEMPLATE_HEADERS = [
  "product_name",
  "sku",
  "category",
  "description",
  "unit_of_measure",
  "price",
  "active_ingredients",
  "application_rate",
  "crop_targets",
  "regulatory_label_url",
  "msds_url",
  "manufacturer",
  "notes",
];

function downloadCSVTemplate() {
  const sample = [
    "Acme Boost 4-0-8",
    "ACME-408-25L",
    "Liquid fertilizer",
    "Foliar nutrient blend for row crops",
    "25 L jug",
    "189.00",
    "N 4% / K 8% / Zn 0.5%",
    "1-2 qt/acre",
    "Corn|Soy|Wheat",
    "https://example.com/label.pdf",
    "https://example.com/sds.pdf",
    "Acme Ag",
    "Tank-mix compatible",
  ].map((v) => `"${v.replace(/"/g, '""')}"`).join(",");
  const csv = `${TEMPLATE_HEADERS.join(",")}\n${sample}\n`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "jericho_supplier_product_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function SupplierIntake() {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [form, setForm] = useState({
    supplier_company: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    product_categories: "",
    notes: "",
  });

  const addFiles = (incoming: File[]) => {
    const valid: File[] = [];
    for (const f of incoming) {
      if (f.size > MAX_BYTES) {
        toast({ title: "File too large", description: `${f.name} exceeds 25MB.`, variant: "destructive" });
        continue;
      }
      // de-dupe by name+size
      if (files.some((x) => x.name === f.name && x.size === f.size)) continue;
      valid.push(f);
    }
    const merged = [...files, ...valid].slice(0, MAX_FILES);
    if (files.length + valid.length > MAX_FILES) {
      toast({ title: "File limit reached", description: `Up to ${MAX_FILES} files per submission.` });
    }
    setFiles(merged);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files ?? []));
    e.target.value = ""; // allow re-selecting the same file
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(Array.from(e.dataTransfer.files ?? []));
  };

  const removeFile = (idx: number) => setFiles(files.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.supplier_company.trim() || !form.contact_name.trim() || !form.contact_email.trim()) {
      toast({ title: "Missing info", description: "Company, name, and email are required.", variant: "destructive" });
      return;
    }
    if (files.length === 0) {
      toast({ title: "No files attached", description: "Please attach at least one spreadsheet or PDF.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    setProgress({ done: 0, total: files.length });
    try {
      const stamp = Date.now();
      const safeCompany = form.supplier_company.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "supplier";
      const folder = `${safeCompany}/${stamp}`;
      // Upload in parallel batches of 4 to avoid overwhelming the connection
      const BATCH = 4;
      const paths: string[] = new Array(files.length);
      const names: string[] = new Array(files.length);
      let completed = 0;
      for (let i = 0; i < files.length; i += BATCH) {
        const slice = files.slice(i, i + BATCH);
        await Promise.all(
          slice.map(async (f, j) => {
            const idx = i + j;
            const safeName = f.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
            const path = `${folder}/${idx}-${safeName}`;
            const { error } = await supabase.storage
              .from("supplier-submissions")
              .upload(path, f, { upsert: false, contentType: f.type || undefined });
            if (error) throw error;
            paths[idx] = path;
            names[idx] = f.name;
            completed += 1;
            setProgress({ done: completed, total: files.length });
          })
        );
      }
      const { error: insErr } = await supabase.from("supplier_submissions").insert({
        supplier_company: form.supplier_company.trim(),
        contact_name: form.contact_name.trim(),
        contact_email: form.contact_email.trim().toLowerCase(),
        contact_phone: form.contact_phone.trim() || null,
        product_categories: form.product_categories.trim() || null,
        notes: form.notes.trim() || null,
        file_paths: paths,
        file_names: names,
      });
      if (insErr) throw insErr;
      setDone(true);
    } catch (err: any) {
      console.error(err);
      toast({ title: "Submission failed", description: err.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-lg w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-primary" />
            </div>
            <CardTitle>Thanks — we got it.</CardTitle>
            <CardDescription>
              Our team will review your product info and reach out if we need anything else. You'll see your products in the Jericho knowledge base soon.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Supplier Product Intake | Jericho</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <header className="border-b bg-card">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-semibold tracking-tight">Supplier Product Intake</h1>
          <p className="text-muted-foreground mt-1">
            Upload your product info so we can load it into the Jericho knowledge base and put it in front of the right reps and growers.
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Format guide */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" /> How to format your file
            </CardTitle>
            <CardDescription>
              The cleaner your data, the faster we can get your products live. Spreadsheets are easiest — but PDF cut sheets work too.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium mb-2">Accepted file types</div>
              <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                <li><strong>Spreadsheets:</strong> CSV, Excel (.xlsx / .xls), Numbers, Google Sheets export, TSV</li>
                <li><strong>Documents:</strong> PDF cut sheets, label PDFs, SDS sheets</li>
                <li>Up to {MAX_FILES} files per submission, max 25MB each</li>
              </ul>
            </div>

            <div>
              <div className="text-sm font-medium mb-2">Recommended columns (one row per product)</div>
              <p className="text-sm text-muted-foreground mb-2">
                Include whatever you have — only <strong>product_name</strong> is truly required. Use a pipe <code className="px-1 rounded bg-muted">|</code> to separate multiple values in one cell (e.g. crop_targets: <code className="px-1 rounded bg-muted">Corn|Soy|Wheat</code>).
              </p>
              <div className="rounded-md border bg-muted/40 p-3 text-xs font-mono overflow-x-auto whitespace-nowrap">
                {TEMPLATE_HEADERS.join(" , ")}
              </div>
              <div className="mt-3 grid sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div><strong className="text-foreground">product_name</strong> — full name as it appears on the label</div>
                <div><strong className="text-foreground">sku</strong> — your part number / product code</div>
                <div><strong className="text-foreground">category</strong> — e.g. Fertilizer, Herbicide, Seed Treatment</div>
                <div><strong className="text-foreground">unit_of_measure</strong> — e.g. 25 L jug, 50 lb bag, ton</div>
                <div><strong className="text-foreground">price</strong> — list price (number only). Optional.</div>
                <div><strong className="text-foreground">active_ingredients</strong> — % composition or AI list</div>
                <div><strong className="text-foreground">application_rate</strong> — e.g. 1-2 qt/acre</div>
                <div><strong className="text-foreground">crop_targets</strong> — pipe-separated crops</div>
                <div><strong className="text-foreground">regulatory_label_url / msds_url</strong> — links if hosted</div>
                <div><strong className="text-foreground">notes</strong> — anything else reps should know</div>
              </div>
              <Button type="button" variant="outline" className="mt-4" onClick={downloadCSVTemplate}>
                <Download className="h-4 w-4" /> Download CSV template
              </Button>
            </div>

            <div className="rounded-md border-l-4 border-primary bg-primary/5 p-3 text-sm">
              <strong>PDF only?</strong> No problem — upload your cut sheets and label PDFs and we'll extract the data on our end. A spreadsheet just speeds things up.
            </div>
          </CardContent>
        </Card>

        {/* Submission form */}
        <Card>
          <CardHeader>
            <CardTitle>Submit your product info</CardTitle>
            <CardDescription>Tell us who you are and attach your files. We'll handle the rest.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company">Supplier company *</Label>
                  <Input id="company" required maxLength={200}
                    value={form.supplier_company}
                    onChange={(e) => setForm({ ...form, supplier_company: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Your name *</Label>
                  <Input id="name" required maxLength={120}
                    value={form.contact_name}
                    onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input id="email" type="email" required maxLength={200}
                    value={form.contact_email}
                    onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" type="tel" maxLength={40}
                    value={form.contact_phone}
                    onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cats">Product categories</Label>
                <Input id="cats" placeholder="e.g. Fertilizer, Adjuvants, Seed Treatment" maxLength={300}
                  value={form.product_categories}
                  onChange={(e) => setForm({ ...form, product_categories: e.target.value })} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes for our team</Label>
                <Textarea id="notes" rows={3} maxLength={2000}
                  placeholder="Anything we should know — exclusivities, regions, launch timing, etc."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>

              <div className="space-y-2">
                <Label>Attach files *</Label>
                <label
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={`flex flex-col items-center justify-center border-2 border-dashed rounded-md p-6 cursor-pointer transition ${
                    dragOver ? "border-primary bg-primary/5" : "hover:bg-accent/5"
                  }`}
                >
                  <Upload className="h-6 w-6 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground text-center">
                    <strong className="text-foreground">Drop files here</strong> or click to choose
                    <br />
                    <span className="text-xs">CSV, Excel, Numbers, Sheets, PDF — up to {MAX_FILES} at once</span>
                  </span>
                  <input type="file" multiple accept={ACCEPTED} className="hidden" onChange={handleFileChange} />
                </label>
                {files.length > 0 && (
                  <>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                    <span>{files.length} file{files.length === 1 ? "" : "s"} attached</span>
                    <button type="button" onClick={() => setFiles([])} className="hover:text-destructive">
                      Clear all
                    </button>
                  </div>
                  <ul className="space-y-1 mt-1 max-h-64 overflow-y-auto">
                    {files.map((f, i) => (
                      <li key={i} className="flex items-center justify-between text-sm border rounded px-3 py-2">
                        <span className="flex items-center gap-2 truncate">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="truncate">{f.name}</span>
                          <span className="text-muted-foreground text-xs shrink-0">({(f.size / 1024 / 1024).toFixed(1)}MB)</span>
                        </span>
                        <button type="button" onClick={() => removeFile(i)} className="text-xs text-muted-foreground hover:text-destructive ml-3">
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                  </>
                )}
              </div>

              <Button type="submit" size="lg" disabled={submitting} className="w-full">
                {submitting
                  ? progress
                    ? `Uploading ${progress.done} of ${progress.total}…`
                    : "Uploading…"
                  : "Submit product info"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}