import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { Eye, EyeOff, Lock, RefreshCw, Check, X, User, Mail, Headphones, Send, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { SMSOptInCard } from "@/components/SMSOptInCard";
import { IntegrationsSection } from "@/components/IntegrationsSection";
import { TelegramLinkCard } from "@/components/TelegramLinkCard";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  hasUpperCase: /[A-Z]/,
  hasLowerCase: /[a-z]/,
  hasNumber: /[0-9]/,
  hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/,
};

type PasswordStrength = "weak" | "fair" | "good" | "strong";

const checkPasswordStrength = (password: string): PasswordStrength => {
  let score = 0;
  if (password.length >= PASSWORD_REQUIREMENTS.minLength) score++;
  if (PASSWORD_REQUIREMENTS.hasUpperCase.test(password)) score++;
  if (PASSWORD_REQUIREMENTS.hasLowerCase.test(password)) score++;
  if (PASSWORD_REQUIREMENTS.hasNumber.test(password)) score++;
  if (PASSWORD_REQUIREMENTS.hasSpecialChar.test(password)) score++;

  if (score <= 2) return "weak";
  if (score === 3) return "fair";
  if (score === 4) return "good";
  return "strong";
};

const getPasswordRequirements = (password: string) => [
  { label: "At least 8 characters", met: password.length >= PASSWORD_REQUIREMENTS.minLength },
  { label: "One uppercase letter", met: PASSWORD_REQUIREMENTS.hasUpperCase.test(password) },
  { label: "One lowercase letter", met: PASSWORD_REQUIREMENTS.hasLowerCase.test(password) },
  { label: "One number", met: PASSWORD_REQUIREMENTS.hasNumber.test(password) },
  { label: "One special character", met: PASSWORD_REQUIREMENTS.hasSpecialChar.test(password) },
];

const strengthColors: Record<PasswordStrength, string> = {
  weak: "bg-red-500",
  fair: "bg-amber-500",
  good: "bg-blue-500",
  strong: "bg-green-500",
};

const strengthLabels: Record<PasswordStrength, string> = {
  weak: "Weak",
  fair: "Fair",
  good: "Good",
  strong: "Strong",
};

export default function Settings() {
  const { toast } = useToast();
  const { isEnabled: isSmsEnabled } = useFeatureFlag('sms_engagement');
  const [loading, setLoading] = useState(false);
  const [savingPodcast, setSavingPodcast] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profile, setProfile] = useState<{ full_name: string; email: string; podcast_duration_minutes: number; hide_daily_brief: boolean } | null>(null);
  const [savingHideBrief, setSavingHideBrief] = useState(false);
  
  // Email preferences state
  const [emailPrefs, setEmailPrefs] = useState({
    email_enabled: false,
    preferred_time: "07:00:00",
    timezone: "America/Chicago",
    frequency: "daily",
    preferred_day: "Monday",
    include_podcast: true,
    brief_format: "both",
    skip_weekends: false
  });

  const timezones = [
    { value: "America/New_York", label: "Eastern Time (ET)" },
    { value: "America/Chicago", label: "Central Time (CT)" },
    { value: "America/Denver", label: "Mountain Time (MT)" },
    { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
    { value: "America/Phoenix", label: "Arizona (MST)" },
    { value: "UTC", label: "UTC" },
  ];

  const timeOptions = Array.from({ length: 24 }, (_, i) => {
    const hour = i;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return {
      value: `${String(hour).padStart(2, '0')}:00:00`,
      label: `${displayHour}:00 ${ampm}`
    };
  });

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Fetch profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name, podcast_duration_minutes, hide_daily_brief")
          .eq("id", user.id)
          .single();
        
        setProfile({
          full_name: profileData?.full_name || "",
          email: user.email || "",
          podcast_duration_minutes: profileData?.podcast_duration_minutes || 2,
          hide_daily_brief: profileData?.hide_daily_brief ?? false,
        });

        // Fetch email preferences
        const { data: emailData } = await supabase
          .from("email_preferences")
          .select("*")
          .eq("profile_id", user.id)
          .single();

        if (emailData) {
          setEmailPrefs({
            email_enabled: emailData.email_enabled ?? false,
            preferred_time: emailData.preferred_time || "07:00:00",
            timezone: emailData.timezone || "America/Chicago",
            frequency: emailData.frequency || "daily",
            preferred_day: emailData.preferred_day || "Monday",
            include_podcast: emailData.include_podcast ?? true,
            brief_format: emailData.brief_format || "both",
            skip_weekends: (emailData as any).skip_weekends ?? false
          });
        }
      }
    };
    fetchData();
  }, []);

  const handlePodcastDurationChange = async (value: string) => {
    const newDuration = parseInt(value);
    if (!profile) return;
    
    setSavingPodcast(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("profiles")
        .update({ podcast_duration_minutes: newDuration })
        .eq("id", user.id);

      if (error) throw error;

      setProfile({ ...profile, podcast_duration_minutes: newDuration });
      toast({
        title: "Preference saved",
        description: `Your daily brief will now be ${newDuration} minutes.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save preference.",
        variant: "destructive",
      });
    } finally {
      setSavingPodcast(false);
    }
  };

  const saveEmailPrefs = async (updates: Partial<typeof emailPrefs>) => {
    setSavingEmail(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const newPrefs = { ...emailPrefs, ...updates };
      setEmailPrefs(newPrefs);

      const { error } = await supabase
        .from("email_preferences")
        .upsert({
          profile_id: user.id,
          email_enabled: newPrefs.email_enabled,
          preferred_time: newPrefs.preferred_time,
          timezone: newPrefs.timezone,
          frequency: newPrefs.frequency,
          preferred_day: newPrefs.preferred_day,
          include_podcast: newPrefs.include_podcast,
          brief_format: newPrefs.brief_format,
          skip_weekends: newPrefs.skip_weekends,
          updated_at: new Date().toISOString()
        }, { onConflict: 'profile_id' });

      if (error) throw error;

      toast({
        title: "Preferences saved",
        description: "Your email delivery settings have been updated.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save preferences.",
        variant: "destructive",
      });
    } finally {
      setSavingEmail(false);
    }
  };

  const sendTestEmail = async () => {
    setSendingTest(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      toast({
        title: "Generating brief...",
        description: "Creating your personalized podcast and email. This may take a minute.",
      });

      const today = new Date().toISOString().split('T')[0];
      
      // Generate podcast
      const { error: genError } = await supabase.functions.invoke("auto-generate-podcasts", {
        body: { profileIds: [user.id], batchSize: 1 }
      });

      if (genError) {
        console.warn("Podcast generation warning:", genError);
      }

      // Send the email
      const { data, error } = await supabase.functions.invoke("send-daily-brief-email", {
        body: { profileId: user.id, episodeDate: today }
      });

      if (error) throw error;

      toast({
        title: "Test email sent! 🎉",
        description: `Check your inbox at ${profile?.email}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send test email.",
        variant: "destructive",
      });
    } finally {
      setSendingTest(false);
    }
  };

  const passwordStrength = checkPasswordStrength(newPassword);
  const requirements = getPasswordRequirements(newPassword);
  const allRequirementsMet = requirements.every((r) => r.met);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  const handleChangePassword = async () => {
    if (!allRequirementsMet) {
      toast({
        title: "Password Requirements",
        description: "Please meet all password requirements.",
        variant: "destructive",
      });
      return;
    }

    if (!passwordsMatch) {
      toast({
        title: "Passwords Don't Match",
        description: "Please ensure both passwords match.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        if (error.message.includes("pwned") || error.message.includes("compromised")) {
          toast({
            title: "Password Compromised",
            description: "This password has been found in data breaches. Please choose a different password.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      toast({
        title: "Password Updated",
        description: "Your password has been changed successfully.",
      });
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update password.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings</p>
      </div>

      {/* Profile Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Information
          </CardTitle>
          <CardDescription>Your account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Name
              </Label>
              <div className="p-3 bg-muted rounded-md text-sm">
                {profile?.full_name || "Not set"}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Email
              </Label>
              <div className="p-3 bg-muted rounded-md text-sm">
                {profile?.email || "Not set"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daily Podcast Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Headphones className="h-5 w-5" />
            Daily Growth Brief
          </CardTitle>
          <CardDescription>Customize your personalized audio briefing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Show/Hide Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Show on Dashboard</Label>
              <p className="text-sm text-muted-foreground">
                Display the Daily Growth Brief player on your growth plan page
              </p>
            </div>
            <Switch
              checked={!profile?.hide_daily_brief}
              onCheckedChange={async (checked) => {
                if (!profile) return;
                setSavingHideBrief(true);
                try {
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) throw new Error("Not authenticated");
                  
                  const { error } = await supabase
                    .from("profiles")
                    .update({ hide_daily_brief: !checked })
                    .eq("id", user.id);
                  
                  if (error) throw error;
                  
                  setProfile({ ...profile, hide_daily_brief: !checked });
                  toast({
                    title: "Preference saved",
                    description: checked ? "Daily Growth Brief will now appear on your dashboard." : "Daily Growth Brief is now hidden from your dashboard.",
                  });
                } catch (error: any) {
                  toast({
                    title: "Error",
                    description: error.message || "Failed to save preference.",
                    variant: "destructive",
                  });
                } finally {
                  setSavingHideBrief(false);
                }
              }}
              disabled={savingHideBrief}
            />
          </div>

          <div className="space-y-3">
            <Label>Episode Duration</Label>
            <RadioGroup
              value={String(profile?.podcast_duration_minutes || 2)}
              onValueChange={handlePodcastDurationChange}
              disabled={savingPodcast}
              className="grid gap-3"
            >
              <div className="flex items-center space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="1" id="duration-1" />
                <Label htmlFor="duration-1" className="flex-1 cursor-pointer">
                  <div className="font-medium">Power Brief (1 min)</div>
                  <div className="text-sm text-muted-foreground">Ultra-quick hit: one win, one insight, one challenge. Perfect when you're short on time.</div>
                </Label>
              </div>
              <div className="flex items-center space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="2" id="duration-2" />
                <Label htmlFor="duration-2" className="flex-1 cursor-pointer">
                  <div className="font-medium">Quick Brief (2 min)</div>
                  <div className="text-sm text-muted-foreground">Perfect for busy mornings. Covers wins, one insight, and your daily challenge.</div>
                </Label>
              </div>
              <div className="flex items-center space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="5" id="duration-5" />
                <Label htmlFor="duration-5" className="flex-1 cursor-pointer">
                  <div className="font-medium">Standard Brief (5 min)</div>
                  <div className="text-sm text-muted-foreground">Deeper dive with goal check-ins, capability insights, and motivational moments.</div>
                </Label>
              </div>
              <div className="flex items-center space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="10" id="duration-10" />
                <Label htmlFor="duration-10" className="flex-1 cursor-pointer">
                  <div className="font-medium">Extended Brief (10 min)</div>
                  <div className="text-sm text-muted-foreground">Comprehensive session with masterclass content, exercises, and weekly planning.</div>
                </Label>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {/* Daily Brief Email Delivery */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Daily Brief Email
          </CardTitle>
          <CardDescription>Get your growth brief delivered to your inbox</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Email Delivery</Label>
              <p className="text-sm text-muted-foreground">
                Receive your daily growth brief via email
              </p>
            </div>
            <Switch
              checked={emailPrefs.email_enabled}
              onCheckedChange={(checked) => saveEmailPrefs({ email_enabled: checked })}
              disabled={savingEmail}
            />
          </div>

          {emailPrefs.email_enabled && (
            <>
              {/* Frequency */}
              <div className="space-y-3">
                <Label>Frequency</Label>
                <RadioGroup
                  value={emailPrefs.frequency}
                  onValueChange={(value) => saveEmailPrefs({ frequency: value })}
                  disabled={savingEmail}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="daily" id="freq-daily" />
                    <Label htmlFor="freq-daily" className="cursor-pointer">Daily</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="weekly" id="freq-weekly" />
                    <Label htmlFor="freq-weekly" className="cursor-pointer">Weekly</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Time and Timezone */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Delivery Time
                  </Label>
                  <Select
                    value={emailPrefs.preferred_time}
                    onValueChange={(value) => saveEmailPrefs({ preferred_time: value })}
                    disabled={savingEmail}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timeOptions.map((time) => (
                        <SelectItem key={time.value} value={time.value}>
                          {time.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Select
                    value={emailPrefs.timezone}
                    onValueChange={(value) => saveEmailPrefs({ timezone: value })}
                    disabled={savingEmail}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timezones.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Weekly day selection */}
              {emailPrefs.frequency === "weekly" && (
                <div className="space-y-2">
                  <Label>Delivery Day</Label>
                  <Select
                    value={emailPrefs.preferred_day}
                    onValueChange={(value) => saveEmailPrefs({ preferred_day: value })}
                    disabled={savingEmail}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {days.map((day) => (
                        <SelectItem key={day} value={day}>
                          {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Brief Format */}
              <div className="space-y-3">
                <Label>Brief Format</Label>
                <RadioGroup
                  value={emailPrefs.brief_format}
                  onValueChange={(value) => saveEmailPrefs({ brief_format: value })}
                  disabled={savingEmail}
                  className="grid gap-3"
                >
                  <div className="flex items-center space-x-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="both" id="format-both" />
                    <Label htmlFor="format-both" className="flex-1 cursor-pointer">
                      <div className="font-medium">Audio + Summary</div>
                      <div className="text-sm text-muted-foreground">Listen button plus written highlights</div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="audio" id="format-audio" />
                    <Label htmlFor="format-audio" className="flex-1 cursor-pointer">
                      <div className="font-medium">Audio Only</div>
                      <div className="text-sm text-muted-foreground">Just the podcast link</div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="text" id="format-text" />
                    <Label htmlFor="format-text" className="flex-1 cursor-pointer">
                      <div className="font-medium">Text Only</div>
                      <div className="text-sm text-muted-foreground">Written summary without audio</div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Skip Weekend Emails */}
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="space-y-0.5">
                  <Label>Skip Weekend Emails</Label>
                  <p className="text-sm text-muted-foreground">
                    Don't send emails on Saturday or Sunday
                  </p>
                </div>
                <Switch
                  checked={emailPrefs.skip_weekends}
                  onCheckedChange={(checked) => saveEmailPrefs({ skip_weekends: checked })}
                  disabled={savingEmail}
                />
              </div>

              {/* Include Podcast Toggle */}
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="space-y-0.5">
                  <Label>Generate Audio Podcast</Label>
                  <p className="text-sm text-muted-foreground">
                    Create a personalized audio brief each day
                  </p>
                </div>
                <Switch
                  checked={emailPrefs.include_podcast}
                  onCheckedChange={(checked) => saveEmailPrefs({ include_podcast: checked })}
                  disabled={savingEmail}
                />
              </div>

              {/* Send Test Button */}
              <div className="pt-4 border-t">
                <Button
                  onClick={sendTestEmail}
                  disabled={sendingTest}
                  variant="outline"
                  className="w-full"
                >
                  {sendingTest ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Generating & Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send Test Email Now
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Generates today's brief and sends it to {profile?.email}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Telegram Integration */}
      <TelegramLinkCard />

      {/* Integrations Section */}
      <IntegrationsSection />

      {/* SMS Notifications Card - only shown when feature is enabled */}
      {isSmsEnabled && <SMSOptInCard />}

      {/* Change Password Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Change Password
          </CardTitle>
          <CardDescription>Update your password to keep your account secure</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* New Password */}
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowNewPassword(!showNewPassword)}
              >
                {showNewPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          {/* Password Strength */}
          {newPassword && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Password Strength</span>
                <span
                  className={cn(
                    "text-sm font-medium",
                    passwordStrength === "weak" && "text-red-500",
                    passwordStrength === "fair" && "text-amber-500",
                    passwordStrength === "good" && "text-blue-500",
                    passwordStrength === "strong" && "text-green-500"
                  )}
                >
                  {strengthLabels[passwordStrength]}
                </span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-all duration-300",
                    strengthColors[passwordStrength]
                  )}
                  style={{
                    width:
                      passwordStrength === "weak"
                        ? "25%"
                        : passwordStrength === "fair"
                        ? "50%"
                        : passwordStrength === "good"
                        ? "75%"
                        : "100%",
                  }}
                />
              </div>
            </div>
          )}

          {/* Requirements */}
          {newPassword && (
            <div className="space-y-2">
              <span className="text-sm text-muted-foreground">Requirements</span>
              <div className="grid gap-1">
                {requirements.map((req, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    {req.met ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className={req.met ? "text-green-600" : "text-muted-foreground"}>
                      {req.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
            {confirmPassword && !passwordsMatch && (
              <p className="text-sm text-red-500">Passwords do not match</p>
            )}
            {passwordsMatch && (
              <p className="text-sm text-green-500 flex items-center gap-1">
                <Check className="h-4 w-4" /> Passwords match
              </p>
            )}
          </div>

          <Button
            onClick={handleChangePassword}
            disabled={loading || !allRequirementsMet || !passwordsMatch}
            className="w-full sm:w-auto"
          >
            {loading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              "Update Password"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
