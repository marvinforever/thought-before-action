import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireManager?: boolean;
}

export const ProtectedRoute = ({ 
  children, 
  requireAdmin = false,
  requireManager = false 
}: ProtectedRouteProps) => {
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Check admin status if required
      if (requireAdmin) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_admin, is_super_admin")
          .eq("id", user.id)
          .single();

        if (profile?.is_admin || profile?.is_super_admin) {
          setHasAccess(true);
        } else {
          navigate("/dashboard/my-growth-plan");
        }
      }
      // Check manager status if required
      else if (requireManager) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .in("role", ["manager", "admin", "super_admin"]);

        if (roles && roles.length > 0) {
          setHasAccess(true);
        } else {
          navigate("/dashboard/my-growth-plan");
        }
      } else {
        setHasAccess(true);
      }
    } catch (error) {
      console.error("Error checking access:", error);
      navigate("/dashboard/my-growth-plan");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return hasAccess ? <>{children}</> : null;
};
