import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Global error handler component that catches unhandled promise rejections
 * and errors that would otherwise crash the app to a white screen.
 * 
 * This is especially important for network failures during auth token refresh
 * which can cause the entire app to crash.
 */
export function GlobalErrorHandler() {
  useEffect(() => {
    // Handle unhandled promise rejections (e.g., failed network requests)
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error("Unhandled promise rejection:", event.reason);
      
      // Prevent the default browser behavior (which can crash the page)
      event.preventDefault();
      
      // Check if it's a network error
      const isNetworkError = 
        event.reason?.message?.includes("Failed to fetch") ||
        event.reason?.message?.includes("NetworkError") ||
        event.reason?.message?.includes("Network request failed") ||
        event.reason?.name === "TypeError" && event.reason?.message?.includes("fetch");
      
      if (isNetworkError) {
        // Don't spam the user with network error toasts - they're often transient
        console.warn("Network error detected, will retry automatically");
      } else {
        // For other unhandled errors, show a toast
        toast.error("Something went wrong. Please try again.", {
          id: "global-error", // Prevent duplicate toasts
          duration: 3000,
        });
      }
    };

    // Handle uncaught errors
    const handleError = (event: ErrorEvent) => {
      console.error("Uncaught error:", event.error);
      
      // Prevent the default browser behavior
      event.preventDefault();
      
      // Show a user-friendly error message
      toast.error("An unexpected error occurred. Please refresh if needed.", {
        id: "global-error",
        duration: 3000,
      });
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("error", handleError);

    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.removeEventListener("error", handleError);
    };
  }, []);

  return null;
}
