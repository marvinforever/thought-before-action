import { useState, useEffect } from "react";
import { Copy, RefreshCw, Check, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeName: string;
  onSuccess: (password: string) => void;
}

interface PasswordStrength {
  score: number;
  label: string;
  color: string;
}

const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  hasUppercase: /[A-Z]/,
  hasLowercase: /[a-z]/,
  hasNumber: /[0-9]/,
  hasSpecial: /[!@#$%^&*(),.?":{}|<>]/,
};

const generateSecurePassword = (): string => {
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowercase = "abcdefghjkmnpqrstuvwxyz";
  const numbers = "23456789";
  const special = "!@#$%^&*";
  
  // Ensure at least one of each type
  let password = "";
  password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
  password += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
  password += numbers.charAt(Math.floor(Math.random() * numbers.length));
  password += special.charAt(Math.floor(Math.random() * special.length));
  
  // Fill remaining with random from all
  const allChars = uppercase + lowercase + numbers + special;
  for (let i = 0; i < 12; i++) {
    password += allChars.charAt(Math.floor(Math.random() * allChars.length));
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

const checkPasswordStrength = (password: string): PasswordStrength => {
  let score = 0;
  
  if (password.length >= PASSWORD_REQUIREMENTS.minLength) score++;
  if (password.length >= 12) score++;
  if (PASSWORD_REQUIREMENTS.hasUppercase.test(password)) score++;
  if (PASSWORD_REQUIREMENTS.hasLowercase.test(password)) score++;
  if (PASSWORD_REQUIREMENTS.hasNumber.test(password)) score++;
  if (PASSWORD_REQUIREMENTS.hasSpecial.test(password)) score++;
  
  if (score <= 2) return { score, label: "Weak", color: "bg-destructive" };
  if (score <= 4) return { score, label: "Fair", color: "bg-yellow-500" };
  if (score <= 5) return { score, label: "Good", color: "bg-blue-500" };
  return { score, label: "Strong", color: "bg-green-500" };
};

const getPasswordRequirements = (password: string) => [
  { label: "At least 8 characters", met: password.length >= PASSWORD_REQUIREMENTS.minLength },
  { label: "Uppercase letter", met: PASSWORD_REQUIREMENTS.hasUppercase.test(password) },
  { label: "Lowercase letter", met: PASSWORD_REQUIREMENTS.hasLowercase.test(password) },
  { label: "Number", met: PASSWORD_REQUIREMENTS.hasNumber.test(password) },
  { label: "Special character (!@#$%^&*)", met: PASSWORD_REQUIREMENTS.hasSpecial.test(password) },
];

export function ResetPasswordDialog({
  open,
  onOpenChange,
  employeeId,
  employeeName,
  onSuccess,
}: ResetPasswordDialogProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const strength = checkPasswordStrength(password);
  const requirements = getPasswordRequirements(password);
  const allRequirementsMet = requirements.every(r => r.met);

  useEffect(() => {
    if (open) {
      // Auto-generate a secure password when dialog opens
      setPassword(generateSecurePassword());
      setError(null);
      setCopied(false);
    }
  }, [open]);

  const handleGenerate = () => {
    setPassword(generateSecurePassword());
    setError(null);
    setCopied(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied!",
        description: "Password copied to clipboard",
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Please manually select and copy the password",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async () => {
    setError(null);

    if (!allRequirementsMet) {
      setError("Password does not meet all requirements");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('reset-employee-password', {
        body: {
          employee_id: employeeId,
          new_password: password,
        }
      });

      if (invokeError) {
        throw new Error(invokeError.message || "Failed to reset password");
      }

      if (data?.error) {
        // Handle specific error types from the edge function
        const errorMessage = data.error;
        
        if (errorMessage.includes("compromised") || errorMessage.includes("pwned") || errorMessage.includes("breach")) {
          setError("This password has been found in a data breach. Please generate a new unique password.");
        } else if (errorMessage.includes("weak")) {
          setError("This password is too weak. Please use a stronger password with more variety.");
        } else {
          setError(errorMessage);
        }
        return;
      }

      onSuccess(password);
      toast({
        title: "Password Reset",
        description: `Password for ${employeeName} has been reset successfully.`,
      });
      onOpenChange(false);
      setPassword("");
    } catch (err: any) {
      const message = err.message || "Failed to reset password";
      
      if (message.includes("compromised") || message.includes("pwned") || message.includes("breach")) {
        setError("This password has been found in a data breach. Please generate a new unique password.");
      } else if (message.includes("weak")) {
        setError("This password is too weak. Please use a stronger password with more variety.");
      } else {
        setError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setPassword("");
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            Generate a new temporary password for {employeeName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Password Input */}
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Temporary Password</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="Enter or generate password"
                  className="pr-10 font-mono"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCopy}
                title="Copy to clipboard"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleGenerate}
                title="Generate new password"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Password Strength Indicator */}
          {password && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Password Strength:</span>
                <span className={cn(
                  "font-medium",
                  strength.label === "Weak" && "text-destructive",
                  strength.label === "Fair" && "text-yellow-500",
                  strength.label === "Good" && "text-blue-500",
                  strength.label === "Strong" && "text-green-500"
                )}>
                  {strength.label}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={cn("h-full transition-all duration-300", strength.color)}
                  style={{ width: `${(strength.score / 6) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Requirements Checklist */}
          {password && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground mb-2">Requirements:</p>
              <div className="grid grid-cols-2 gap-1">
                {requirements.map((req, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs">
                    <div className={cn(
                      "h-3 w-3 rounded-full flex items-center justify-center",
                      req.met ? "bg-green-500" : "bg-muted"
                    )}>
                      {req.met && <Check className="h-2 w-2 text-white" />}
                    </div>
                    <span className={req.met ? "text-muted-foreground" : "text-muted-foreground/60"}>
                      {req.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div className="text-sm text-destructive">
                {error}
                {error.includes("breach") && (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0 ml-1 text-destructive underline"
                    onClick={handleGenerate}
                  >
                    Generate a new one
                  </Button>
                )}
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            The password will be shown once after reset. Make sure to copy it before closing.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !allRequirementsMet}
          >
            {isSubmitting ? "Resetting..." : "Reset Password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
