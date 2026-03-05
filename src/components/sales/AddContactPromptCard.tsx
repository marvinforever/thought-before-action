import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { UserPlus, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

interface ContactPrompt {
  name: string;
  companyName?: string;
}

interface AddContactPromptCardProps {
  prompt: ContactPrompt;
  userId: string;
  onDismiss: () => void;
  onAdded: (name: string) => void;
}

export function AddContactPromptCard({ prompt, userId, onDismiss, onAdded }: AddContactPromptCardProps) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState(false);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);

  const [form, setForm] = useState({
    name: prompt.name,
    title: "",
    company_id: "",
    phone: "",
    email: "",
    notes: "",
  });

  const openForm = async () => {
    // Fetch companies for the selector
    const { data } = await supabase
      .from("sales_companies")
      .select("id, name")
      .eq("profile_id", userId)
      .order("name");
    setCompanies(data || []);

    // Pre-select company if name matches
    if (prompt.companyName && data) {
      const match = data.find(c => c.name.toLowerCase().includes(prompt.companyName!.toLowerCase()));
      if (match) setForm(f => ({ ...f, company_id: match.id }));
    }

    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);

    const { error } = await supabase.from("sales_contacts").insert({
      name: form.name.trim(),
      title: form.title || null,
      company_id: form.company_id || null,
      phone: form.phone || null,
      email: form.email || null,
      notes: form.notes || null,
      profile_id: userId,
    });

    setSaving(false);

    if (error) {
      toast({ title: "Error adding contact", variant: "destructive" });
      return;
    }

    setShowForm(false);
    setAdded(true);
    onAdded(form.name);

    // Auto-dismiss after showing confirmation
    setTimeout(() => onDismiss(), 3000);
  };

  if (added) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, height: 0 }}
        className="ml-10 mt-1 mb-2 text-sm text-primary flex items-center gap-1.5"
      >
        <Check className="h-3.5 w-3.5" />
        {form.name} added to your contacts.
      </motion.div>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4, height: 0 }}
        className="ml-10 mt-1 mb-2 rounded-lg border border-border bg-muted/50 px-3 py-2.5 flex items-center gap-3 max-w-[85%]"
      >
        <span className="text-base">👤</span>
        <p className="text-sm text-foreground flex-1">
          <span className="font-medium">{prompt.name}</span>{" "}
          <span className="text-muted-foreground">isn't in your contacts yet</span>
        </p>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 h-7 text-xs border-primary/30 text-primary hover:bg-primary/10 shrink-0"
          onClick={openForm}
        >
          <UserPlus className="h-3 w-3" />
          Add {prompt.name.split(" ")[0]}
        </Button>
      </motion.div>

      <Sheet open={showForm} onOpenChange={setShowForm}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Add Contact</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Operations Manager"
              />
            </div>
            <div className="space-y-2">
              <Label>Company</Label>
              <Select
                value={form.company_id}
                onValueChange={v => setForm(f => ({ ...f, company_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="bill@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Key info about this contact..."
                rows={3}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleSave} disabled={saving || !form.name.trim()}>
                {saving ? "Saving..." : "Save Contact"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
