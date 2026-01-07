import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Trash2, Edit, User, Mail, Phone, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ContactsManagerProps {
  userId: string;
}

export const ContactsManager = ({ userId }: ContactsManagerProps) => {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);
  
  const [form, setForm] = useState({
    name: "",
    title: "",
    email: "",
    phone: "",
    company_id: "",
    is_decision_maker: false,
    is_primary: false,
    notes: "",
  });

  const fetchData = async () => {
    const [contactsRes, companiesRes] = await Promise.all([
      supabase
        .from("sales_contacts")
        .select(`*, sales_companies(name)`)
        .eq("profile_id", userId)
        .order("name"),
      supabase
        .from("sales_companies")
        .select("id, name")
        .eq("profile_id", userId)
        .order("name"),
    ]);

    if (contactsRes.error) {
      toast({ title: "Error loading contacts", variant: "destructive" });
    } else {
      setContacts(contactsRes.data || []);
    }

    setCompanies(companiesRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (userId) fetchData();
  }, [userId]);

  const resetForm = () => {
    setForm({
      name: "",
      title: "",
      email: "",
      phone: "",
      company_id: "",
      is_decision_maker: false,
      is_primary: false,
      notes: "",
    });
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast({ title: "Contact name is required", variant: "destructive" });
      return;
    }

    const payload = {
      ...form,
      company_id: form.company_id || null,
      profile_id: userId,
    };

    if (editingContact) {
      const { error } = await supabase
        .from("sales_contacts")
        .update(payload)
        .eq("id", editingContact.id);

      if (error) {
        toast({ title: "Error updating contact", variant: "destructive" });
      } else {
        toast({ title: "Contact updated" });
        setEditingContact(null);
        resetForm();
        fetchData();
      }
    } else {
      const { error } = await supabase
        .from("sales_contacts")
        .insert(payload);

      if (error) {
        toast({ title: "Error adding contact", variant: "destructive" });
      } else {
        toast({ title: "Contact added" });
        setShowAdd(false);
        resetForm();
        fetchData();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this contact?")) return;

    const { error } = await supabase
      .from("sales_contacts")
      .delete()
      .eq("id", id);

    if (error) {
      toast({ title: "Error deleting contact", variant: "destructive" });
    } else {
      toast({ title: "Contact deleted" });
      fetchData();
    }
  };

  const startEdit = (contact: any) => {
    setForm({
      name: contact.name || "",
      title: contact.title || "",
      email: contact.email || "",
      phone: contact.phone || "",
      company_id: contact.company_id || "",
      is_decision_maker: contact.is_decision_maker || false,
      is_primary: contact.is_primary || false,
      notes: contact.notes || "",
    });
    setEditingContact(contact);
  };

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.sales_companies?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const ContactForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Name *</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="John Smith"
          />
        </div>
        <div className="space-y-2">
          <Label>Title</Label>
          <Input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Operations Manager"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Email</Label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="john@example.com"
          />
        </div>
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="(555) 123-4567"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Company</Label>
        <Select
          value={form.company_id}
          onValueChange={(v) => setForm({ ...form, company_id: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a company" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">No company</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Checkbox
            id="decision_maker"
            checked={form.is_decision_maker}
            onCheckedChange={(checked) =>
              setForm({ ...form, is_decision_maker: !!checked })
            }
          />
          <Label htmlFor="decision_maker" className="cursor-pointer">
            Decision Maker
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="primary"
            checked={form.is_primary}
            onCheckedChange={(checked) =>
              setForm({ ...form, is_primary: !!checked })
            }
          />
          <Label htmlFor="primary" className="cursor-pointer">
            Primary Contact
          </Label>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Key information about this contact..."
          rows={3}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => {
            setShowAdd(false);
            setEditingContact(null);
            resetForm();
          }}
        >
          Cancel
        </Button>
        <Button onClick={handleSubmit}>
          {editingContact ? "Update Contact" : "Add Contact"}
        </Button>
      </div>
    </div>
  );

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading contacts...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Contact
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Contact</DialogTitle>
            </DialogHeader>
            <ContactForm />
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingContact} onOpenChange={(open) => !open && setEditingContact(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
          </DialogHeader>
          <ContactForm />
        </DialogContent>
      </Dialog>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Contact Info</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredContacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No contacts yet. Add your first contact!
                </TableCell>
              </TableRow>
            ) : (
              filteredContacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{contact.name}</p>
                        {contact.title && (
                          <p className="text-xs text-muted-foreground">{contact.title}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {contact.sales_companies?.name ? (
                      <span className="flex items-center gap-1 text-sm">
                        <Building2 className="h-3 w-3" />
                        {contact.sales_companies.name}
                      </span>
                    ) : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {contact.email && (
                        <a
                          href={`mailto:${contact.email}`}
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <Mail className="h-3 w-3" />
                          {contact.email}
                        </a>
                      )}
                      {contact.phone && (
                        <a
                          href={`tel:${contact.phone}`}
                          className="flex items-center gap-1 text-xs text-muted-foreground"
                        >
                          <Phone className="h-3 w-3" />
                          {contact.phone}
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {contact.is_decision_maker && (
                        <Badge variant="default" className="text-xs">DM</Badge>
                      )}
                      {contact.is_primary && (
                        <Badge variant="secondary" className="text-xs">Primary</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => startEdit(contact)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(contact.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
