import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Download, Trash2, CheckCircle2, Clock, Inbox, RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Submission = {
  id: string;
  supplier_company: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  product_categories: string | null;
  notes: string | null;
  file_paths: string[];
  file_names: string[];
  status: string;
  reviewed_at: string | null;
  created_at: string;
};

const STATUSES = ["new", "in_review", "imported", "archived"];

const statusVariant = (s: string) =>
  s === "new" ? "default" : s === "in_review" ? "secondary" : s === "imported" ? "outline" : "outline";

export default function AdminSupplierSubmissions() {
  const { toast } = useToast();
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("supplier_submissions")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Failed to load", description: error.message, variant: "destructive" });
    } else {
      setItems((data || []) as Submission[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const downloadFile = async (path: string, name: string) => {
    const { data, error } = await supabase.storage
      .from("supplier-submissions")
      .createSignedUrl(path, 60 * 10);
    if (error || !data) {
      toast({ title: "Download failed", description: error?.message, variant: "destructive" });
      return;
    }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = name;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const updateStatus = async (id: string, status: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("supplier_submissions")
      .update({ status, reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    setItems((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  };

  const remove = async (s: Submission) => {
    if (!confirm(`Delete submission from ${s.supplier_company}? This will remove uploaded files too.`)) return;
    if (s.file_paths?.length) {
      await supabase.storage.from("supplier-submissions").remove(s.file_paths);
    }
    const { error } = await supabase.from("supplier_submissions").delete().eq("id", s.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    setItems((prev) => prev.filter((x) => x.id !== s.id));
    toast({ title: "Deleted" });
  };

  return (
    <>
      <Helmet>
        <title>Supplier Submissions | Super Admin</title>
      </Helmet>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Supplier Submissions</h1>
            <p className="text-muted-foreground text-sm">
              Review product info submitted via the supplier intake form.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Inbox className="h-10 w-10 mx-auto mb-3 opacity-50" />
              No submissions yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {items.map((s) => (
              <Card key={s.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">{s.supplier_company}</CardTitle>
                      <CardDescription>
                        {s.contact_name} · {s.contact_email}
                        {s.contact_phone ? ` · ${s.contact_phone}` : ""}
                      </CardDescription>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(s.created_at).toLocaleString()}
                        {s.reviewed_at && (
                          <>
                            <span>·</span>
                            <CheckCircle2 className="h-3 w-3" />
                            Reviewed {new Date(s.reviewed_at).toLocaleDateString()}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusVariant(s.status) as any}>{s.status}</Badge>
                      <Select value={s.status} onValueChange={(v) => updateStatus(s.id, v)}>
                        <SelectTrigger className="h-8 w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((st) => (
                            <SelectItem key={st} value={st}>
                              {st}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="icon" variant="ghost" onClick={() => remove(s)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {s.product_categories && (
                    <div className="text-sm">
                      <span className="font-medium">Categories: </span>
                      <span className="text-muted-foreground">{s.product_categories}</span>
                    </div>
                  )}
                  {s.notes && (
                    <div className="text-sm">
                      <span className="font-medium">Notes: </span>
                      <span className="text-muted-foreground whitespace-pre-wrap">{s.notes}</span>
                    </div>
                  )}
                  {s.file_paths?.length > 0 && (
                    <div>
                      <div className="text-sm font-medium mb-2">Files ({s.file_paths.length})</div>
                      <div className="flex flex-wrap gap-2">
                        {s.file_paths.map((p, i) => (
                          <Button
                            key={p}
                            variant="outline"
                            size="sm"
                            onClick={() => downloadFile(p, s.file_names[i] || `file-${i + 1}`)}
                          >
                            <Download className="h-3 w-3 mr-2" />
                            {s.file_names[i] || `file-${i + 1}`}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
