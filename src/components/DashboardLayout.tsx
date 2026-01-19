import { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  Target, 
  Mail, 
  Settings,
  LogOut,
  Menu,
  Upload,
  Shield,
  GraduationCap,
  Map,
  Handshake,
  TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useViewAs } from "@/contexts/ViewAsContext";

const DashboardLayout = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { clearViewAsCompany } = useViewAs();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      try {
        setUser(session?.user ?? null);
        if (!session) {
          navigate("/auth");
        } else {
          // Check if user is super admin or admin and if registration is complete
          const { data: profile, error } = await supabase
            .from("profiles")
            .select("is_super_admin, is_admin, registration_complete, created_by_admin")
            .eq("id", session.user.id)
            .maybeSingle();
          
          if (!error && profile) {
            setIsSuperAdmin(profile.is_super_admin || false);
            setIsAdmin(profile.is_admin || false);
            
            // Only redirect to registration for truly new users (created within last 5 minutes)
            // who haven't completed registration and weren't admin-created
            if (!profile.registration_complete && !profile.created_by_admin) {
              const createdAt = new Date(session.user.created_at);
              const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
              if (createdAt > fiveMinutesAgo) {
                navigate("/register");
                return;
              }
            }
          } else if (!profile) {
            // No profile exists - only redirect for truly new users
            const createdAt = new Date(session.user.created_at);
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            if (createdAt > fiveMinutesAgo) {
              navigate("/register");
              return;
            }
          }

          // Check if user has manager role
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", session.user.id)
            .in("role", ["manager", "admin", "super_admin"]);
          
          setIsManager((roles && roles.length > 0) || false);
        }
      } catch (error) {
        console.error("Error loading session:", error);
      } finally {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
        setIsSuperAdmin(false);
      } else {
        // Defer profile fetch to avoid deadlocks in auth callback
        setTimeout(async () => {
          try {
            const { data: profile, error } = await supabase
              .from("profiles")
              .select("is_super_admin, is_admin")
              .eq("id", session.user!.id)
              .maybeSingle();
            if (!error) {
              setIsSuperAdmin(profile?.is_super_admin || false);
              setIsAdmin(profile?.is_admin || false);
            }

            // Check if user has manager role
            const { data: roles } = await supabase
              .from("user_roles")
              .select("role")
              .eq("user_id", session.user!.id)
              .in("role", ["manager", "admin", "super_admin"]);
            
            setIsManager((roles && roles.length > 0) || false);
          } catch (error) {
            console.error("Error fetching profile after auth change:", error);
          }
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    clearViewAsCompany(); // Clear ViewAs state on logout
    await supabase.auth.signOut();
    toast({ title: "Logged out successfully" });
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) return null;

  // Role-based navigation: Employees only see My Growth Plan + My Capabilities + My Resources
  // Partner Portal is available to everyone
  const navItems = isAdmin || isManager || isSuperAdmin 
    ? [
        // Dashboard temporarily hidden - only visible to super admins
        ...(isSuperAdmin ? [{ icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" }] : []),
        { icon: GraduationCap, label: "My Growth Plan", path: "/dashboard/my-growth-plan" },
        { icon: Target, label: "My Capabilities", path: "/dashboard/my-capabilities" },
        { icon: BookOpen, label: "My Resources", path: "/dashboard/my-resources" },
        { icon: LayoutDashboard, label: "Personal Assistant", path: "/dashboard/personal-assistant" },
        { icon: TrendingUp, label: "Sales Trainer", path: "/sales-trainer" },
        ...(isManager ? [{ icon: Users, label: "My Team", path: "/dashboard/manager" }] : []),
        { icon: Users, label: "Employees", path: "/dashboard/employees" },
        { icon: Target, label: "Capabilities", path: "/dashboard/capabilities" },
        { icon: BookOpen, label: "Resources", path: "/dashboard/resources" },
        { icon: Upload, label: "Import Resources", path: "/dashboard/resource-import" },
        { icon: Handshake, label: "Partner Portal", path: "/partner" },
        { icon: Settings, label: "Settings", path: "/dashboard/settings" },
      ]
    : [
        { icon: GraduationCap, label: "My Growth Plan", path: "/dashboard/my-growth-plan" },
        { icon: Target, label: "My Capabilities", path: "/dashboard/my-capabilities" },
        { icon: BookOpen, label: "My Resources", path: "/dashboard/my-resources" },
        { icon: LayoutDashboard, label: "Personal Assistant", path: "/dashboard/personal-assistant" },
        { icon: TrendingUp, label: "Sales Trainer", path: "/sales-trainer" },
        { icon: Handshake, label: "Partner Portal", path: "/partner" },
        { icon: Settings, label: "Settings", path: "/dashboard/settings" },
      ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-sidebar-border bg-sidebar shrink-0">
        <h1 className="text-2xl font-bold text-sidebar-primary">Jericho</h1>
        <p className="text-sm text-sidebar-foreground/70">by The Momentum Company</p>
      </div>
      <nav className="p-4 space-y-2 bg-sidebar flex-1 overflow-y-auto">
        {isSuperAdmin && (
          <Button
            variant="ghost"
            className="w-full justify-start bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent/80"
            onClick={() => {
              navigate("/super-admin");
              setMobileMenuOpen(false);
            }}
          >
            <Shield className="mr-3 h-5 w-5" />
            Super Admin
          </Button>
        )}
        {navItems.map((item) => (
          <Button
            key={item.path}
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={() => {
              navigate(item.path);
              setMobileMenuOpen(false);
            }}
          >
            <item.icon className="mr-3 h-5 w-5" />
            {item.label}
          </Button>
        ))}
      </nav>
      <div className="p-4 border-t border-sidebar-border bg-sidebar shrink-0">
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground hover:bg-destructive/20 hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="mr-3 h-5 w-5" />
          Logout
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar - always visible */}
      {!isMobile && (
        <aside className="fixed left-0 top-0 h-full w-64 bg-sidebar border-r border-sidebar-border z-40">
          <SidebarContent />
        </aside>
      )}

      {/* Main Content */}
      <div className={cn(
        "transition-all duration-300 min-h-screen",
        !isMobile ? "ml-64" : "ml-0"
      )}>
        {/* Header */}
        <header className="bg-card border-b border-border sticky top-0 z-30">
          <div className="flex items-center justify-between p-3 md:p-4">
            {/* Mobile menu trigger - only shows on mobile */}
            {isMobile ? (
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0">
                  <SidebarContent />
                </SheetContent>
              </Sheet>
            ) : (
              <div /> /* Empty spacer on desktop */
            )}
            <div className="flex items-center gap-2 md:gap-4">
              <span className="text-xs md:text-sm text-muted-foreground truncate max-w-[120px] md:max-w-none">
                {user.email}
              </span>
            </div>
          </div>
        </header>

        {/* Page Content - reduced padding on mobile */}
        <main className="p-3 md:p-6 pb-20 md:pb-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;