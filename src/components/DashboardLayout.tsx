import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
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
  Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const DashboardLayout = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const navigate = useNavigate();
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
          
          if (!error) {
            setIsSuperAdmin(profile?.is_super_admin || false);
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
        setIsSuperAdmin(false);
      } else {
        // Defer profile fetch to avoid deadlocks in auth callback
        setTimeout(async () => {
          try {
            const { data: profile, error } = await supabase
              .from("profiles")
              .select("is_super_admin")
              .eq("id", session.user!.id)
              .maybeSingle();
            if (!error) {
              setIsSuperAdmin(profile?.is_super_admin || false);
            }
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

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    { icon: Users, label: "Employees", path: "/dashboard/employees" },
    { icon: Upload, label: "Import Data", path: "/dashboard/import" },
    { icon: Target, label: "Capabilities", path: "/dashboard/capabilities" },
    { icon: BookOpen, label: "Resources", path: "/dashboard/resources" },
    { icon: Mail, label: "Email Delivery", path: "/dashboard/emails" },
    { icon: Settings, label: "Settings", path: "/dashboard/settings" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 h-full bg-card border-r border-border transition-all duration-300 z-40",
        sidebarOpen ? "w-64" : "w-0 -translate-x-full"
      )}>
        <div className="p-6 border-b border-border">
          <h1 className="text-2xl font-bold text-primary">Jericho</h1>
          <p className="text-sm text-muted-foreground">Capability Platform</p>
        </div>
        <nav className="p-4 space-y-2">
          {isSuperAdmin && (
            <Button
              variant="ghost"
              className="w-full justify-start bg-primary/10 text-primary hover:bg-primary/20"
              onClick={() => navigate("/super-admin")}
            >
              <Shield className="mr-3 h-5 w-5" />
              Super Admin
            </Button>
          )}
          {navItems.map((item) => (
            <Button
              key={item.path}
              variant="ghost"
              className="w-full justify-start"
              onClick={() => navigate(item.path)}
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.label}
            </Button>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border">
          <Button
            variant="ghost"
            className="w-full justify-start text-destructive hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="mr-3 h-5 w-5" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className={cn(
        "transition-all duration-300",
        sidebarOpen ? "ml-64" : "ml-0"
      )}>
        {/* Header */}
        <header className="bg-card border-b border-border sticky top-0 z-30">
          <div className="flex items-center justify-between p-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu className="h-5 w-5" />
            </Button>
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

export default DashboardLayout;