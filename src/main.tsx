import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";


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
