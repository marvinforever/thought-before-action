import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useViewAs } from "@/contexts/ViewAsContext";
import { Separator } from "@/components/ui/separator";

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
        // For existing sessions, always go to dashboard
        // Registration wizard is only for fresh signups handled below
        navigate("/dashboard/my-growth-plan", { replace: true });
      }
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Don't redirect on password recovery events or during signup flow
      if (event === "PASSWORD_RECOVERY") return;
      if (isSigningUp) return; // Don't redirect while signup is in progress
      if (session) {
        // Only check registration_complete for SIGNED_IN events (fresh logins)
        // For existing sessions, we already handled it above
        if (event === "SIGNED_IN") {
          const { data: profile } = await supabase
            .from('profiles')
            .select('registration_complete')
            .eq('id', session.user.id)
            .single();
          
          // Only redirect to register for fresh signups where registration is incomplete
          // profile?.registration_complete will be null for admin-created users, which is fine
          if (profile && profile.registration_complete === false) {
            // Check if user was created recently (within last 5 minutes) - indicates fresh signup
            const createdAt = new Date(session.user.created_at);
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            if (createdAt > fiveMinutesAgo) {
              navigate("/register", { replace: true });
              return;
            }
          }
        }
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
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { toast } = useToast();

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      clearViewAsCompany();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard/my-growth-plan`,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setGoogleLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Clear any persisted ViewAs state on login
      clearViewAsCompany();
      
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        toast({ title: "Welcome back!", description: "Successfully logged in." });

        // Deterministic redirect (don't rely on auth listener timing)
        const params = new URLSearchParams(window.location.search);
        const redirect = params.get("redirect");
        const safeRedirect = redirect && redirect.startsWith("/") ? redirect : null;

        navigate(safeRedirect || "/dashboard/my-growth-plan", { replace: true });
        return;
      } else {
        // Set flag to prevent onAuthStateChange from redirecting prematurely
        setIsSigningUp(true);
        
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/register`,
          },
        });
        if (authError) {
          setIsSigningUp(false);
          throw authError;
        }

        if (authData.user) {
          // For self-serve signup, redirect to registration wizard
          // The wizard will handle profile creation and onboarding
          toast({ title: "Account created!", description: "Let's get you set up." });
          setIsSigningUp(false);
          navigate("/register");
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
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="Jane Smith"
                />
              </div>
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
            <Button type="submit" variant="accent" className="w-full" disabled={loading || googleLoading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isResetPassword ? "Send Reset Link" : isLogin ? "Sign In" : "Create Account"}
            </Button>
          </form>
          
          {!isResetPassword && (
            <>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>
              
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleGoogleSignIn}
                disabled={loading || googleLoading}
              >
                {googleLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                )}
                Continue with Google
              </Button>
            </>
          )}
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