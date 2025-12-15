import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Ensures password recovery links work even when the backend falls back to the Site URL ("/").
 * Recovery links can arrive as:
 * - /#access_token=...&type=recovery
 * - /?code=... (PKCE) (sometimes with type=recovery)
 */
export function AuthHashRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Only auto-redirect when the user lands on the public root.
    if (location.pathname !== "/") return;

    const hash = location.hash ?? "";
    const search = location.search ?? "";

    const isRecovery =
      hash.includes("type=recovery") ||
      hash.includes("access_token=") ||
      search.includes("type=recovery") ||
      search.includes("code=");

    if (!isRecovery) return;

    // Preserve query + hash so ResetPassword can complete the auth recovery flow.
    navigate(`/reset-password${search}${hash}`, { replace: true });
  }, [location.pathname, location.search, location.hash, navigate]);

  return null;
}
