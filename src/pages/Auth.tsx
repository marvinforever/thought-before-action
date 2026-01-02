import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useViewAs } from "@/contexts/ViewAsContext";

const Auth = () => {
  const navigate = useNavigate();
  // Track if we're in the middle of a signup flow to prevent premature redirect
  const [isSigningUp, setIsSigningUp] = useState(false);
  
  // Check if user is already logged in and redirect to dashboard
  // But redirect to reset-password if this is a password recovery flow
  useEffect(() => {
    const hash = window.location.hash ?? "";
    const search = window.location.search ?? "";
    
    const isRecoveryFlow = hash.includes("type=recovery") || 
                           hash.includes("access_token=") ||
                           search.includes("type=recovery") ||
                           search.includes("code=");
    
    // If this is a recovery flow, redirect to reset-password with params preserved
    if (isRecoveryFlow) {
      navigate(`/reset-password${search}${hash}`, { replace: true });
      return;
    }

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard/my-growth-plan", { replace: true });
      }
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Don't redirect on password recovery events or during signup flow
      if (event === "PASSWORD_RECOVERY") return;
      if (isSigningUp) return; // Don't redirect while signup is in progress
      if (session) {
        navigate("/dashboard/my-growth-plan", { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, isSigningUp]);
  const { clearViewAsCompany } = useViewAs();
  const [isLogin, setIsLogin] = useState(true);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Clear any persisted ViewAs state on login
      clearViewAsCompany();
      
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast({ title: "Welcome back!", description: "Successfully logged in." });
        navigate("/dashboard");
      } else {
        // Set flag to prevent onAuthStateChange from redirecting prematurely
        setIsSigningUp(true);
        
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });
        if (authError) {
          setIsSigningUp(false);
          throw authError;
        }

        if (authData.user) {
          try {
            // Create company
            const { data: company, error: companyError } = await supabase
              .from("companies")
              .insert({ name: companyName })
              .select()
              .single();
            
            if (companyError) throw companyError;

            // Create profile
            const { error: profileError } = await supabase
              .from("profiles")
              .insert({
                id: authData.user.id,
                company_id: company.id,
                full_name: fullName,
                email,
                is_admin: true,
              });
            
            if (profileError) throw profileError;

            toast({ title: "Account created!", description: "Welcome to Jericho." });
            setIsSigningUp(false);
            navigate("/dashboard/my-growth-plan");
          } catch (error) {
            setIsSigningUp(false);
            throw error;
          }
        } else {
          setIsSigningUp(false);
        }
      }
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

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) throw error;
      
      toast({
        title: "Check your email",
        description: "We've sent you a password reset link.",
      });
      setIsResetPassword(false);
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
          <CardTitle className="text-xl font-semibold">
            {isResetPassword ? "Reset password" : isLogin ? "Welcome back" : "Create your account"}
          </CardTitle>
          <CardDescription className="text-center">
            {isResetPassword
              ? "Enter your email to receive a password reset link"
              : isLogin 
                ? "Sign in to your dashboard"
                : "Start building your team's capabilities"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={isResetPassword ? handlePasswordReset : handleAuth} className="space-y-4">
            {!isLogin && !isResetPassword && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            {!isResetPassword && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {isLogin && (
                    <button
                      type="button"
                      onClick={() => setIsResetPassword(true)}
                      className="text-xs text-primary hover:underline"
                      disabled={loading}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={6}
                />
              </div>
            )}
            <Button type="submit" variant="accent" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isResetPassword ? "Send Reset Link" : isLogin ? "Sign In" : "Create Account"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            {isResetPassword ? (
              <>
                Remember your password?{" "}
                <button
                  type="button"
                  onClick={() => setIsResetPassword(false)}
                  className="text-primary hover:underline font-medium"
                  disabled={loading}
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-primary hover:underline font-medium"
                  disabled={loading}
                >
                  {isLogin ? "Sign up" : "Sign in"}
                </button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;