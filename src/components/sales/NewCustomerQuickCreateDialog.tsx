import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Building2, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface NewCustomerQuickCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefilledName: string;
  userId: string;
  onSuccess: (companyId: string, companyName: string) => void;
}

interface FormData {
  name: string;
  phone: string;
  email: string;
  address: string;
  contactName: string;
}

export function NewCustomerQuickCreateDialog({
  open,
  onOpenChange,
  prefilledName,
  userId,
  onSuccess,
}: NewCustomerQuickCreateDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormData>({
    name: prefilledName,
    phone: "",
    email: "",
    address: "",
    contactName: "",
  });
  const [errors, setErrors] = useState<Partial<FormData>>({});

  // Sync pre-filled name when the dialog opens with a new value
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setForm((prev) => ({ ...prev, name: prefilledName }));
      setErrors({});
    }
    onOpenChange(isOpen);
  };

  const validate = (): boolean => {
    const newErrors: Partial<FormData> = {};
    const name = form.name.trim();
    if (!name) newErrors.name = "Company name is required";
    else if (name.length < 2) newErrors.name = "Name must be at least 2 characters";
    else if (name.length > 100) newErrors.name = "Name must be under 100 characters";

    if (form.phone && !/^[\d\s().+\-]{7,20}$/.test(form.phone.trim())) {
      newErrors.phone = "Enter a valid phone number";
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      newErrors.email = "Enter a valid email address";
    }
    if (form.contactName && form.contactName.trim().length > 100) {
      newErrors.contactName = "Contact name must be under 100 characters";
    }
    if (form.address && form.address.trim().length > 200) {
      newErrors.address = "Address must be under 200 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);

    try {
      // Build notes from optional fields
      const notesParts: string[] = [];
      if (form.phone.trim()) notesParts.push(`📞 Phone: ${form.phone.trim()}`);
      if (form.email.trim()) notesParts.push(`📧 Email: ${form.email.trim()}`);
      if (form.address.trim()) notesParts.push(`📍 Address: ${form.address.trim()}`);
      if (form.contactName.trim()) notesParts.push(`👤 Contact: ${form.contactName.trim()}`);
      notesParts.push(`📅 Created via Sales Agent: ${new Date().toLocaleDateString()}`);

      // Insert company
      const { data: company, error: companyError } = await supabase
        .from("sales_companies")
        .insert({
          profile_id: userId,
          name: form.name.trim(),
          notes: notesParts.join("\n"),
        } as any)
        .select("id, name")
        .single();

      if (companyError) throw companyError;

      // If contact name provided, also create a contact record
      if (form.contactName.trim() && company) {
        await supabase.from("sales_contacts").insert({
          profile_id: userId,
          company_id: company.id,
          name: form.contactName.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
        } as any);
      }

      toast({
        title: "✅ Customer profile created",
        description: `${company.name} has been added to your companies.`,
      });

      onSuccess(company.id, company.name);
      onOpenChange(false);

      // Reset form
      setForm({ name: prefilledName, phone: "", email: "", address: "", contactName: "" });
    } catch (err: any) {
      console.error("Error creating customer:", err);
      toast({
        title: "Failed to create customer",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Building2 className="h-4 w-4 text-primary-foreground" />
            </div>
            <DialogTitle className="text-lg">Create Customer Profile</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Jericho detected this customer in your conversation. Fill in their details to keep your pipeline complete.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Company Name */}
          <div className="space-y-1.5">
            <Label htmlFor="qc-name" className="text-sm font-medium">
              Company Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="qc-name"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="e.g. Green Valley Farms"
              className={errors.name ? "border-destructive" : ""}
              maxLength={100}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Contact Name */}
          <div className="space-y-1.5">
            <Label htmlFor="qc-contact" className="text-sm font-medium">
              Contact Person
            </Label>
            <Input
              id="qc-contact"
              value={form.contactName}
              onChange={(e) => handleChange("contactName", e.target.value)}
              placeholder="e.g. John Smith"
              className={errors.contactName ? "border-destructive" : ""}
              maxLength={100}
            />
            {errors.contactName && (
              <p className="text-xs text-destructive">{errors.contactName}</p>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label htmlFor="qc-phone" className="text-sm font-medium">
              Phone Number
            </Label>
            <Input
              id="qc-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              placeholder="e.g. (555) 123-4567"
              className={errors.phone ? "border-destructive" : ""}
              maxLength={20}
            />
            {errors.phone && (
              <p className="text-xs text-destructive">{errors.phone}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="qc-email" className="text-sm font-medium">
              Email Address
            </Label>
            <Input
              id="qc-email"
              type="email"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="e.g. john@greenvalley.com"
              className={errors.email ? "border-destructive" : ""}
              maxLength={255}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email}</p>
            )}
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <Label htmlFor="qc-address" className="text-sm font-medium">
              Physical Address
            </Label>
            <Input
              id="qc-address"
              value={form.address}
              onChange={(e) => handleChange("address", e.target.value)}
              placeholder="e.g. 123 Farm Road, Springfield, IL"
              className={errors.address ? "border-destructive" : ""}
              maxLength={200}
            />
            {errors.address && (
              <p className="text-xs text-destructive">{errors.address}</p>
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Skip for Now
          </Button>
          <Button
            className="flex-1 gap-2"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            {saving ? "Saving..." : "Create Profile"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
