import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Building2, Search, Trash2, Edit, Globe, MapPin, DollarSign, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CustomerDetailDialog } from "./CustomerDetailDialog";
import { AddDealDialog } from "./AddDealDialog";

interface CompaniesManagerProps {
  userId: string;
}

export const CompaniesManager = ({ userId }: CompaniesManagerProps) => {
  const { toast } = useToast();
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editingCompany, setEditingCompany] = useState<any>(null);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [showAddDeal, setShowAddDeal] = useState(false);
  
  const [form, setForm] = useState({
    name: "",
    industry: "",
    location: "",
    website: "",
    annual_revenue: "",
    employee_count: "",
    notes: "",
  });

  // Parse grower_history to extract total revenue
  const parseGrowerHistory = (history: string | null): number => {
    if (!history) return 0;
    try {
      const parsed = JSON.parse(history);
      if (Array.isArray(parsed)) {
        return parsed.reduce((sum, item) => sum + (item.total_revenue || 0), 0);
      }
    } catch {
      const matches = history.match(/\$[\d,]+/g);
      if (matches) {
        return matches.reduce((sum, match) => sum + parseFloat(match.replace(/[$,]/g, '')), 0);
      }
    }
    return 0;
  };

  const formatCurrency = (value: number) => {
    if (value === 0) return "-";
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const fetchCompanies = async () => {
    const { data, error } = await supabase
      .from("sales_companies")
      .select("*")
      .eq("profile_id", userId)
      .order("name");

    if (error) {
      toast({ title: "Error loading companies", variant: "destructive" });
    } else {
      setCompanies(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (userId) fetchCompanies();
  }, [userId]);

  const resetForm = () => {
    setForm({
      name: "",
      industry: "",
      location: "",
      website: "",
      annual_revenue: "",
      employee_count: "",
      notes: "",
    });
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast({ title: "Company name is required", variant: "destructive" });
      return;
    }

    if (editingCompany) {
      const { error } = await supabase
        .from("sales_companies")
        .update(form)
        .eq("id", editingCompany.id);

      if (error) {
        toast({ title: "Error updating company", variant: "destructive" });
      } else {
        toast({ title: "Company updated" });
        setEditingCompany(null);
        resetForm();
        fetchCompanies();
      }
    } else {
      const { error } = await supabase
        .from("sales_companies")
        .insert({ ...form, profile_id: userId });

      if (error) {
        toast({ title: "Error adding company", variant: "destructive" });
      } else {
        toast({ title: "Company added" });
        setShowAdd(false);
        resetForm();
        fetchCompanies();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this company? Associated deals will be unlinked.")) return;

    const { error } = await supabase
      .from("sales_companies")
      .delete()
      .eq("id", id);

    if (error) {
      toast({ title: "Error deleting company", variant: "destructive" });
    } else {
      toast({ title: "Company deleted" });
      fetchCompanies();
    }
  };

  const startEdit = (company: any) => {
    setForm({
      name: company.name || "",
      industry: company.industry || "",
      location: company.location || "",
      website: company.website || "",
      annual_revenue: company.annual_revenue || "",
      employee_count: company.employee_count || "",
      notes: company.notes || "",
    });
    setEditingCompany(company);
  };

  const filteredCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.industry?.toLowerCase().includes(search.toLowerCase())
  );

  const CompanyForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Company Name *</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Acme Co-op"
          />
        </div>
        <div className="space-y-2">
          <Label>Industry</Label>
          <Input
            value={form.industry}
            onChange={(e) => setForm({ ...form, industry: e.target.value })}
            placeholder="Agriculture"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Location</Label>
          <Input
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="Des Moines, IA"
          />
        </div>
        <div className="space-y-2">
          <Label>Website</Label>
          <Input
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
            placeholder="https://example.com"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Annual Revenue</Label>
          <Input
            value={form.annual_revenue}
            onChange={(e) => setForm({ ...form, annual_revenue: e.target.value })}
            placeholder="$5M - $10M"
          />
        </div>
        <div className="space-y-2">
          <Label>Employee Count</Label>
          <Input
            value={form.employee_count}
            onChange={(e) => setForm({ ...form, employee_count: e.target.value })}
            placeholder="50-100"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Key information about this account..."
          rows={3}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => {
            setShowAdd(false);
            setEditingCompany(null);
            resetForm();
          }}
        >
          Cancel
        </Button>
        <Button onClick={handleSubmit}>
          {editingCompany ? "Update Company" : "Add Company"}
        </Button>
      </div>
    </div>
  );

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading companies...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search companies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Company
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Company</DialogTitle>
            </DialogHeader>
            <CompanyForm />
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingCompany} onOpenChange={(open) => !open && setEditingCompany(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Company</DialogTitle>
          </DialogHeader>
          <CompanyForm />
        </DialogContent>
      </Dialog>

      {/* Customer Detail Dialog */}
      <CustomerDetailDialog
        open={!!selectedCompany}
        onOpenChange={(open) => !open && setSelectedCompany(null)}
        customerId={selectedCompany?.id || null}
        companyId={undefined}
      />

      {/* Add Deal Dialog */}
      <AddDealDialog
        open={showAddDeal}
        onOpenChange={setShowAddDeal}
        userId={userId}
        onSuccess={() => {
          setShowAddDeal(false);
          toast({ title: "Deal created successfully" });
        }}
      />

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  History
                </span>
              </TableHead>
              <TableHead className="w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCompanies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No companies yet. Add your first prospect!
                </TableCell>
              </TableRow>
            ) : (
              filteredCompanies.map((company) => {
                const historyRevenue = parseGrowerHistory(company.grower_history);
                return (
                  <TableRow 
                    key={company.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedCompany(company)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{company.name}</p>
                          {company.website && (
                            <a
                              href={company.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Globe className="h-3 w-3" />
                              Website
                            </a>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{company.industry || "-"}</TableCell>
                    <TableCell>
                      {company.location ? (
                        <span className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3 w-3" />
                          {company.location}
                        </span>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      {historyRevenue > 0 ? (
                        <Badge variant="secondary" className="font-mono">
                          {formatCurrency(historyRevenue)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="View Details"
                          onClick={() => setSelectedCompany(company)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Edit"
                          onClick={() => startEdit(company)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Delete"
                          onClick={() => handleDelete(company.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Stats */}
      {filteredCompanies.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
          <span>{filteredCompanies.length} companies</span>
          <span>
            Total historical revenue: {formatCurrency(
              filteredCompanies.reduce((sum, c) => sum + parseGrowerHistory(c.grower_history), 0)
            )}
          </span>
        </div>
      )}
    </div>
  );
};
