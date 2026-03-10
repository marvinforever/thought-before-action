import { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { 
  LayoutDashboard, 
  Building2,
  Rocket,
  LogOut,
  Menu,
  ChevronLeft,
  FileSpreadsheet,
  ClipboardList,
  Target,
  MessageCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const SuperAdminLayout = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
          // Check if user is super admin
          const { data: profile, error } = await supabase
            .from("profiles")
            .select("is_super_admin")
            .eq("id", session.user.id)
            .maybeSingle();
          
          if (error || !profile?.is_super_admin) {
            toast({ title: "Access Denied", description: "Super Admin access required", variant: "destructive" });
            navigate("/dashboard");
          }
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
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, toast]);

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

  const navItems = [
    { icon: Building2, label: "Overview", path: "/super-admin" },
    { icon: LayoutDashboard, label: "Analytics", path: "/super-admin/analytics" },
    { icon: Rocket, label: "Demo Setup", path: "/super-admin/demo" },
    { icon: FileSpreadsheet, label: "Customer History", path: "/super-admin/customer-history" },
    { icon: ClipboardList, label: "Diagnostic Import", path: "/super-admin/diagnostic-import" },
    { icon: Target, label: "Targeted Accounts", path: "/super-admin/targeted-accounts" },
    { icon: MessageCircle, label: "Telegram Setup", path: "/super-admin/telegram-setup" },
  ];

  const isActive = (path: string) => location.pathname === path;

  const SidebarContent = () => (
    <>
      <div className="p-6 border-b border-sidebar-border bg-sidebar">
        <h1 className="text-2xl font-bold text-sidebar-primary">Super Admin</h1>
        <p className="text-sm text-sidebar-foreground/70">System Management</p>
      </div>
      <nav className="p-4 space-y-2 bg-sidebar flex-1">
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={() => {
            navigate("/dashboard");
            setMobileMenuOpen(false);
          }}
        >
          <ChevronLeft className="mr-3 h-5 w-5" />
          Back to Dashboard
        </Button>
        <div className="my-4 border-t border-sidebar-border" />
        {navItems.map((item) => (
          <Button
            key={item.path}
            variant="ghost"
            className={cn(
              "w-full justify-start",
              isActive(item.path) 
                ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
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
      <div className="p-4 border-t border-sidebar-border bg-sidebar">
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
          "fixed left-0 top-0 h-full bg-sidebar border-r border-sidebar-border transition-all duration-300 z-40 flex flex-col",
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
                <SheetContent side="left" className="w-64 p-0 flex flex-col">
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

export default SuperAdminLayout;
