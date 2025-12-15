import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, X, Eye, EyeOff } from "lucide-react";

const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  hasUppercase: /[A-Z]/,
  hasLowercase: /[a-z]/,
  hasNumber: /[0-9]/,
  hasSpecial: /[!@#$%^&*(),.?":{}|<>]/,
};

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if we have a valid session from the reset link
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Invalid or expired link",
          description: "Please request a new password reset link.",
          variant: "destructive",
        });
        navigate("/auth");
      }
      setChecking(false);
    };
    checkSession();
  }, [navigate, toast]);

  const getPasswordRequirements = (pwd: string) => [
    { label: "At least 8 characters", met: pwd.length >= PASSWORD_REQUIREMENTS.minLength },
    { label: "One uppercase letter", met: PASSWORD_REQUIREMENTS.hasUppercase.test(pwd) },
    { label: "One lowercase letter", met: PASSWORD_REQUIREMENTS.hasLowercase.test(pwd) },
    { label: "One number", met: PASSWORD_REQUIREMENTS.hasNumber.test(pwd) },
    { label: "One special character", met: PASSWORD_REQUIREMENTS.hasSpecial.test(pwd) },
  ];

  const requirements = getPasswordRequirements(password);
  const allRequirementsMet = requirements.every(r => r.met);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!allRequirementsMet) {
      toast({
        title: "Password too weak",
        description: "Please meet all password requirements.",
        variant: "destructive",
      });
      return;
    }

    if (!passwordsMatch) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are the same.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      
      if (error) {
        if (error.message.includes("pwned") || error.message.includes("compromised")) {
          throw new Error("This password has been found in a data breach. Please choose a different password.");
        }
        throw error;
      }
      
      toast({
        title: "Password updated!",
        description: "You can now sign in with your new password.",
      });
      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary p-4">
      <Card className="w-full max-w-md shadow-2xl border-accent/20">
        <CardHeader className="space-y-3 text-center">
          <div className="flex items-center justify-center gap-3">
            <div className="h-12 w-12 rounded-full bg-accent flex items-center justify-center">
              <span className="text-2xl font-bold text-primary">J</span>
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-bold text-primary">Jericho</h1>
              <p className="text-xs text-muted-foreground">by The Momentum Company</p>
            </div>
          </div>
          <CardTitle className="text-xl font-semibold">Set new password</CardTitle>
          <CardDescription>
            Enter your new password below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
              />
              {confirmPassword && (
                <div className="flex items-center gap-2 text-sm">
                  {passwordsMatch ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <X className="h-4 w-4 text-destructive" />
                  )}
                  <span className={passwordsMatch ? "text-green-500" : "text-destructive"}>
                    {passwordsMatch ? "Passwords match" : "Passwords don't match"}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-2 rounded-lg border p-3 bg-muted/50">
              <p className="text-sm font-medium">Password requirements:</p>
              <div className="space-y-1">
                {requirements.map((req, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    {req.met ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <X className="h-3 w-3 text-muted-foreground" />
                    )}
                    <span className={req.met ? "text-green-500" : "text-muted-foreground"}>
                      {req.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <Button 
              type="submit" 
              variant="accent" 
              className="w-full" 
              disabled={loading || !allRequirementsMet || !passwordsMatch}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
