import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { FloatingJerichoButton } from "@/components/FloatingJerichoButton";
import { ViewAsProvider } from "@/contexts/ViewAsContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import SuperAdmin from "./pages/SuperAdmin";
import SuperAdminDemo from "./pages/SuperAdminDemo";
import Capabilities from "./pages/Capabilities";
import Resources from "./pages/Resources";
import AdminResourceImport from "./pages/AdminResourceImport";
import AdminResourceResearch from "./pages/AdminResourceResearch";
import MyGrowthPlan from "./pages/MyGrowthPlan";
import GrowthRoadmap from "./pages/GrowthRoadmap";
import TrainingROI from "./pages/TrainingROI";
import ManagerDashboard from "./pages/ManagerDashboard";
import MomentumAcademy from "./pages/MomentumAcademy";
import AcademyBlog from "./pages/AcademyBlog";
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
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/super-admin" element={<SuperAdmin />} />
            <Route path="/super-admin/demo" element={<SuperAdminDemo />} />
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={
                <ProtectedRoute requireManager>
                  <Dashboard />
                </ProtectedRoute>
              } />
            <Route path="employees" element={
              <ProtectedRoute requireManager>
                <Employees />
              </ProtectedRoute>
            } />
            <Route path="capabilities" element={
              <ProtectedRoute requireAdmin>
                <Capabilities />
              </ProtectedRoute>
            } />
            <Route path="resources" element={
              <ProtectedRoute requireAdmin>
                <Resources />
              </ProtectedRoute>
            } />
            <Route path="resource-import" element={
              <ProtectedRoute requireAdmin>
                <AdminResourceImport />
              </ProtectedRoute>
            } />
            <Route path="resource-research" element={
              <ProtectedRoute requireAdmin>
                <AdminResourceResearch />
              </ProtectedRoute>
            } />
            <Route path="my-growth-plan" element={<MyGrowthPlan />} />
            <Route path="growth-roadmap" element={<GrowthRoadmap />} />
            <Route path="training-roi" element={
              <ProtectedRoute requireAdmin>
                <TrainingROI />
              </ProtectedRoute>
            } />
            <Route path="manager" element={
              <ProtectedRoute requireManager>
                <ManagerDashboard />
              </ProtectedRoute>
            } />
            <Route path="academy-admin" element={
              <ProtectedRoute requireAdmin>
                <MomentumAcademy />
              </ProtectedRoute>
            } />
          </Route>
            {/* Public Academy Blog */}
            <Route path="/academy" element={<AcademyBlog />} />
            <Route path="/academy/:slug" element={<AcademyBlog />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ViewAsProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
