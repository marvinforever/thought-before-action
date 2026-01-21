import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Dev-host hotfix: the *.lovableproject.com domain can occasionally serve a stale cached build
// after an idle tab. Force everyone onto the canonical Preview domain which always serves the
// latest build artifacts.
const CANONICAL_PREVIEW_ORIGIN = "https://id-preview--9452e9a5-306c-40b5-90e7-b32e0e2a5a12.lovable.app";
try {
  const { hostname, pathname, search, hash } = window.location;
  const isStaleDevHost = hostname.endsWith(".lovableproject.com");
  const isAlreadyCanonical = window.location.origin === CANONICAL_PREVIEW_ORIGIN;

  if (isStaleDevHost && !isAlreadyCanonical) {
    window.location.replace(`${CANONICAL_PREVIEW_ORIGIN}${pathname}${search}${hash}`);
  }
} catch {
  // no-op
}

// Always-fresh: if a service worker was previously registered (e.g. older PWA builds),
// unregister it and clear cache storage so the app cannot serve stale assets.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister();
      });
    })
    .catch(() => {
      // no-op
    });
}

if ("caches" in window) {
  // Best-effort cache clear (some environments may not allow it)
  caches
    .keys()
    .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
    .catch(() => {
      // no-op
    });
}

createRoot(document.getElementById("root")!).render(<App />);
