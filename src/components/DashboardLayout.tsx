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
  Map
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const DashboardLayout = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      try {
        setUser(session?.user ?? null);
        if (!session) {
          navigate("/auth");
        } else {
          // Check if user is super admin or admin
          const { data: profile, error } = await supabase
            .from("profiles")
            .select("is_super_admin, is_admin")
            .eq("id", session.user.id)
            .maybeSingle();
          
          if (!error) {
            setIsSuperAdmin(profile?.is_super_admin || false);
            setIsAdmin(profile?.is_admin || false);
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

  // Role-based navigation: Employees only see My Growth Plan
  const navItems = isAdmin || isManager || isSuperAdmin 
    ? [
        { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
        { icon: GraduationCap, label: "My Growth Plan", path: "/dashboard/my-growth-plan" },
        ...(isManager ? [{ icon: Users, label: "My Team", path: "/dashboard/manager" }] : []),
        { icon: Users, label: "Employees", path: "/dashboard/employees" },
        { icon: Target, label: "Capabilities", path: "/dashboard/capabilities" },
        { icon: BookOpen, label: "Resources", path: "/dashboard/resources" },
        { icon: Upload, label: "Import Resources", path: "/dashboard/resource-import" },
        { icon: Settings, label: "Settings", path: "/dashboard/settings" },
      ]
    : [
        { icon: GraduationCap, label: "My Growth Plan", path: "/dashboard/my-growth-plan" },
        { icon: Settings, label: "Settings", path: "/dashboard/settings" },
      ];

  const SidebarContent = () => (
    <>
      <div className="p-6 border-b border-sidebar-border bg-sidebar">
        <h1 className="text-2xl font-bold text-sidebar-primary">Jericho</h1>
        <p className="text-sm text-sidebar-foreground/70">by The Momentum Company</p>
      </div>
      <nav className="p-4 space-y-2 bg-sidebar">
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
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-sidebar-border bg-sidebar">
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground hover:bg-destructive/20 hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="mr-3 h-5 w-5" />
          Logout
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside className={cn(
          "fixed left-0 top-0 h-full bg-sidebar border-r border-sidebar-border transition-all duration-300 z-40",
          sidebarOpen ? "w-64" : "w-0 -translate-x-full"
        )}>
          <SidebarContent />
        </aside>
      )}

      {/* Main Content */}
      <div className={cn(
        "transition-all duration-300",
        !isMobile && sidebarOpen ? "ml-64" : "ml-0"
      )}>
        {/* Header */}
        <header className="bg-card border-b border-border sticky top-0 z-30">
          <div className="flex items-center justify-between p-4">
            {isMobile ? (
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 p-0">
                  <SidebarContent />
                </SheetContent>
              </Sheet>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                <Menu className="h-5 w-5" />
              </Button>
            )}
            <div className="flex items-center gap-4">
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  // Force navigation even if already on the page
                  if (location.pathname === "/dashboard/my-growth-plan") {
                    // If already on the page, use state to signal tab change
                    navigate("/dashboard/my-growth-plan", { state: { tab: "roadmap" }, replace: true });
                  } else {
                    navigate("/dashboard/my-growth-plan?tab=roadmap");
                  }
                }}
                className="gap-2"
              >
                <Map className="h-4 w-4" />
                My Roadmap
              </Button>
              <span className="text-sm text-muted-foreground">
                {user.email}
              </span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;