import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * SECURITY WARNING: This component provides UX-level route protection ONLY.
 * 
 * CLIENT-SIDE CHECKS ARE NOT A SECURITY BOUNDARY!
 * These checks can be bypassed by manipulating browser code or developer tools.
 * 
 * TRUE SECURITY is enforced by:
 * 1. Row-Level Security (RLS) policies on database tables
 * 2. Server-side authorization in edge functions
 * 3. The server-side permission check endpoint called below
 * 
 * This component is for user experience only - hiding UI elements from
 * unauthorized users. All protected operations MUST verify permissions
 * server-side via RLS or edge function authorization checks.
 */

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
      // First verify user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Call server-side permission check endpoint
      // This performs authorization on the backend where it cannot be manipulated
      const { data, error } = await supabase.functions.invoke('check-user-permissions', {
        body: { requireAdmin, requireManager }
      });

      if (error) {
        console.error("Error checking permissions:", error);
        navigate("/dashboard/my-growth-plan");
        return;
      }

      if (data?.hasAccess) {
        setHasAccess(true);
      } else {
        navigate("/dashboard/my-growth-plan");
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
