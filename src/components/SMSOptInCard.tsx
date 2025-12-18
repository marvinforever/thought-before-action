import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Phone, Shield, Loader2 } from "lucide-react";

export function SMSOptInCard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [originalPhone, setOriginalPhone] = useState("");

  useEffect(() => {
    fetchSmsPreferences();
  }, []);

  const fetchSmsPreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("sms_opted_in, phone")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      setSmsOptIn((data as any)?.sms_opted_in || false);
      setPhoneNumber((data as any)?.phone || "");
      setOriginalPhone((data as any)?.phone || "");
    } catch (error) {
      console.error("Error fetching SMS preferences:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, "");
    
    // Format as (XXX) XXX-XXXX for US numbers
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
  };

  const handleOptInChange = async (checked: boolean) => {
    // If turning on, require phone number
    if (checked && !phoneNumber) {
      toast({
        title: "Phone number required",
        description: "Please enter your phone number to receive SMS notifications.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const updateData: Record<string, any> = {
        sms_opted_in: checked,
      };

      // Set consent timestamp when opting in
      if (checked) {
        updateData.sms_opted_in_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", user.id);

      if (error) throw error;

      setSmsOptIn(checked);
      toast({
        title: checked ? "SMS notifications enabled" : "SMS notifications disabled",
        description: checked 
          ? "You'll receive growth nudges via text message." 
          : "You won't receive SMS notifications.",
      });
    } catch (error: any) {
      console.error("Error updating SMS opt-in:", error);
      toast({
        title: "Error",
        description: "Failed to update SMS preferences.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePhone = async () => {
    if (!phoneNumber) return;

    // Validate phone number (at least 10 digits)
    const digits = phoneNumber.replace(/\D/g, "");
    if (digits.length < 10) {
      toast({
        title: "Invalid phone number",
        description: "Please enter a valid 10-digit phone number.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("profiles")
        .update({ phone: phoneNumber } as any)
        .eq("id", user.id);

      if (error) throw error;

      setOriginalPhone(phoneNumber);
      toast({
        title: "Phone number saved",
        description: "Your phone number has been updated.",
      });
    } catch (error: any) {
      console.error("Error saving phone number:", error);
      toast({
        title: "Error",
        description: "Failed to save phone number.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const phoneChanged = phoneNumber !== originalPhone;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          SMS Notifications
        </CardTitle>
        <CardDescription>
          Receive growth nudges and reminders via text message
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Phone Number Input */}
        <div className="space-y-2">
          <Label htmlFor="phone" className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            Phone Number
          </Label>
          <div className="flex gap-2">
            <Input
              id="phone"
              type="tel"
              value={phoneNumber}
              onChange={handlePhoneChange}
              placeholder="(555) 123-4567"
              className="max-w-[200px]"
            />
            {phoneChanged && (
              <Button 
                size="sm" 
                onClick={handleSavePhone}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            US phone numbers only. Standard messaging rates may apply.
          </p>
        </div>

        {/* Opt-in Toggle */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="sms-opt-in" className="font-medium">
              Enable SMS notifications
            </Label>
            <p className="text-sm text-muted-foreground">
              Get weekly growth nudges and habit reminders
            </p>
          </div>
          <Switch
            id="sms-opt-in"
            checked={smsOptIn}
            onCheckedChange={handleOptInChange}
            disabled={saving}
          />
        </div>

        {/* Consent Notice */}
        <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
          <Shield className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            By enabling SMS notifications, you consent to receive text messages from Momentum. 
            Message frequency varies. Reply STOP to unsubscribe at any time. 
            Your phone number will never be shared with third parties.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
