import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { FloatingJerichoButton } from "@/components/FloatingJerichoButton";
import { ViewAsProvider } from "@/contexts/ViewAsContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import SuperAdmin from "./pages/SuperAdmin";
import Capabilities from "./pages/Capabilities";
import Resources from "./pages/Resources";
import AdminResourceImport from "./pages/AdminResourceImport";
import MyGrowthPlan from "./pages/MyGrowthPlan";
import GrowthRoadmap from "./pages/GrowthRoadmap";
import TrainingROI from "./pages/TrainingROI";
import ManagerDashboard from "./pages/ManagerDashboard";
import DashboardLayout from "./components/DashboardLayout";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ViewAsProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <FloatingJerichoButton />
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/super-admin" element={<SuperAdmin />} />
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<Dashboard />} />
            <Route path="employees" element={<Employees />} />
            <Route path="capabilities" element={<Capabilities />} />
            <Route path="resources" element={<Resources />} />
            <Route path="resource-import" element={<AdminResourceImport />} />
            <Route path="my-growth-plan" element={<MyGrowthPlan />} />
            <Route path="growth-roadmap" element={<GrowthRoadmap />} />
            <Route path="training-roi" element={<TrainingROI />} />
            <Route path="manager" element={<ManagerDashboard />} />
          </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ViewAsProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
