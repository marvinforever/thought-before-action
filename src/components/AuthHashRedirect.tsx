import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Ensures password recovery links work even when the backend falls back to the Site URL ("/").
 * Supabase/Lovable Cloud recovery links often land at "/#access_token=...&type=recovery".
 */
export function AuthHashRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const hash = location.hash ?? "";
    const isRecovery = hash.includes("type=recovery") || hash.includes("error_description=Email%20link%20is%20invalid%20or%20has%20expired") || hash.includes("access_token=");

    if (!isRecovery) return;

    // Preserve the full hash payload so ResetPassword can pick up the session.
    navigate(`/reset-password${hash}`, { replace: true });
  }, [location.hash, navigate]);

  return null;
}
