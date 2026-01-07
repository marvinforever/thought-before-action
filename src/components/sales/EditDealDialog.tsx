import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface EditDealDialogProps {
  deal: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const EditDealDialog = ({ deal, open, onOpenChange, onSuccess }: EditDealDialogProps) => {
  const { toast } = useToast();
  const [companies, setCompanies] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [form, setForm] = useState({
    deal_name: "",
    company_id: "",
    primary_contact_id: "",
    stage: "prospecting",
    value: "",
    expected_close_date: "",
    priority: "3",
    probability: "10",
    notes: "",
  });

  useEffect(() => {
    if (open && deal) {
      setForm({
        deal_name: deal.deal_name || "",
        company_id: deal.company_id || "",
        primary_contact_id: deal.primary_contact_id || "",
        stage: deal.stage || "prospecting",
        value: deal.value?.toString() || "",
        expected_close_date: deal.expected_close_date || "",
        priority: deal.priority?.toString() || "3",
        probability: deal.probability?.toString() || "10",
        notes: deal.notes || "",
      });
      fetchData();
    }
  }, [open, deal]);

  const fetchData = async () => {
    const [companiesRes, contactsRes] = await Promise.all([
      supabase
        .from("sales_companies")
        .select("id, name")
        .eq("profile_id", deal.profile_id)
        .order("name"),
      supabase
        .from("sales_contacts")
        .select("id, name, company_id")
        .eq("profile_id", deal.profile_id)
        .order("name"),
    ]);

    setCompanies(companiesRes.data || []);
    setContacts(contactsRes.data || []);
  };

  const handleSubmit = async () => {
    if (!form.deal_name.trim()) {
      toast({ title: "Deal name is required", variant: "destructive" });
      return;
    }

    setLoading(true);

    const { error } = await supabase
      .from("sales_deals")
      .update({
        deal_name: form.deal_name,
        company_id: form.company_id || null,
        primary_contact_id: form.primary_contact_id || null,
        stage: form.stage as "prospecting" | "discovery" | "proposal" | "closing" | "follow_up",
        value: form.value ? parseFloat(form.value) : null,
        expected_close_date: form.expected_close_date || null,
        priority: parseInt(form.priority),
        probability: parseInt(form.probability),
        notes: form.notes || null,
      })
      .eq("id", deal.id);

    setLoading(false);

    if (error) {
      toast({ title: "Error updating deal", variant: "destructive" });
    } else {
      toast({ title: "Deal updated successfully!" });
      onSuccess();
    }
  };

  const filteredContacts = form.company_id
    ? contacts.filter(c => c.company_id === form.company_id)
    : contacts;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Deal</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Deal Name *</Label>
            <Input
              value={form.deal_name}
              onChange={(e) => setForm({ ...form, deal_name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Company</Label>
              <Select
                value={form.company_id}
                onValueChange={(v) => setForm({ ...form, company_id: v, primary_contact_id: "" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Primary Contact</Label>
              <Select
                value={form.primary_contact_id}
                onValueChange={(v) => setForm({ ...form, primary_contact_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select contact" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {filteredContacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Stage</Label>
              <Select
                value={form.stage}
                onValueChange={(v) => setForm({ ...form, stage: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prospecting">Prospecting</SelectItem>
                  <SelectItem value="discovery">Discovery</SelectItem>
                  <SelectItem value="proposal">Proposal</SelectItem>
                  <SelectItem value="closing">Closing</SelectItem>
                  <SelectItem value="follow_up">Follow Up</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Deal Value ($)</Label>
              <Input
                type="number"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Expected Close</Label>
              <Input
                type="date"
                value={form.expected_close_date}
                onChange={(e) => setForm({ ...form, expected_close_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(v) => setForm({ ...form, priority: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - Highest</SelectItem>
                  <SelectItem value="2">2 - High</SelectItem>
                  <SelectItem value="3">3 - Medium</SelectItem>
                  <SelectItem value="4">4 - Low</SelectItem>
                  <SelectItem value="5">5 - Lowest</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Probability %</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={form.probability}
                onChange={(e) => setForm({ ...form, probability: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
