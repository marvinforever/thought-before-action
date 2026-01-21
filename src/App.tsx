import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { FloatingJerichoButton } from "@/components/FloatingJerichoButton";
import { ViewAsProvider } from "@/contexts/ViewAsContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AuthHashRedirect } from "@/components/AuthHashRedirect";
import { BuildStamp } from "@/components/BuildStamp";

import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import AIReadinessLanding from "./pages/AIReadinessLanding";
import AIReadinessReport from "./pages/AIReadinessReport";
import PartnerRegister from "./pages/PartnerRegister";
import PartnerLogin from "./pages/PartnerLogin";
import PartnerDashboard from "./pages/PartnerDashboard";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import SuperAdmin from "./pages/SuperAdmin";
import SuperAdminDemo from "./pages/SuperAdminDemo";
import SuperAdminLayout from "./components/SuperAdminLayout";
import Capabilities from "./pages/Capabilities";
import Resources from "./pages/Resources";
import AdminResourceImport from "./pages/AdminResourceImport";
import AdminResourceResearch from "./pages/AdminResourceResearch";
import MyGrowthPlan from "./pages/MyGrowthPlan";
import MyCapabilities from "./pages/MyCapabilities";
import MyResources from "./pages/MyResources";
import GrowthRoadmap from "./pages/GrowthRoadmap";
import TrainingROI from "./pages/TrainingROI";
import ManagerDashboard from "./pages/ManagerDashboard";
import MomentumAcademy from "./pages/MomentumAcademy";
import AcademyBlog from "./pages/AcademyBlog";
import Sales from "./pages/Sales";
import SalesTrainer from "./pages/SalesTrainer";
import SalesAgentLanding from "./pages/SalesAgentLanding";
import PublicPrepDocument from "./pages/PublicPrepDocument";
import DashboardLayout from "./components/DashboardLayout";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import { RegistrationWizard } from "./components/RegistrationWizard";
import PersonalAssistant from "./pages/PersonalAssistant";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ViewAsProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthHashRedirect />
          <FloatingJerichoButton />
          <BuildStamp />
          <Routes>
            <Route path="/" element={<Sales />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/register" element={<RegistrationWizard />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            {/* Partner Routes */}
            <Route path="/partner" element={<PartnerDashboard />} />
            <Route path="/partner/register" element={<PartnerRegister />} />
            <Route path="/partner/login" element={<PartnerLogin />} />
            <Route path="/super-admin" element={<SuperAdminLayout />}>
              <Route index element={<SuperAdmin />} />
              <Route path="demo" element={<SuperAdminDemo />} />
            </Route>
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route
                index
                element={
                  <ProtectedRoute requireManager>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="employees"
                element={
                  <ProtectedRoute requireManager>
                    <Employees />
                  </ProtectedRoute>
                }
              />
              <Route
                path="capabilities"
                element={
                  <ProtectedRoute requireAdmin>
                    <Capabilities />
                  </ProtectedRoute>
                }
              />
              <Route
                path="resources"
                element={
                  <ProtectedRoute requireAdmin>
                    <Resources />
                  </ProtectedRoute>
                }
              />
              <Route
                path="resource-import"
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminResourceImport />
                  </ProtectedRoute>
                }
              />
              <Route
                path="resource-research"
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminResourceResearch />
                  </ProtectedRoute>
                }
              />
              <Route path="my-growth-plan" element={<MyGrowthPlan />} />
              <Route path="my-capabilities" element={<MyCapabilities />} />
              <Route path="my-resources" element={<MyResources />} />
              <Route path="growth-roadmap" element={<GrowthRoadmap />} />
              <Route
                path="training-roi"
                element={
                  <ProtectedRoute requireAdmin>
                    <TrainingROI />
                  </ProtectedRoute>
                }
              />
              <Route
                path="manager"
                element={
                  <ProtectedRoute requireManager>
                    <ManagerDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="academy-admin"
                element={
                  <ProtectedRoute requireAdmin>
                    <MomentumAcademy />
                  </ProtectedRoute>
                }
              />
              <Route path="settings" element={<Settings />} />
              <Route path="personal-assistant" element={<PersonalAssistant />} />
            </Route>
            {/* Public Academy Blog */}
            <Route path="/academy" element={<AcademyBlog />} />
            <Route path="/academy/:slug" element={<AcademyBlog />} />
            {/* Sales Trainer - Public with auth */}
            <Route path="/sales-trainer" element={<SalesTrainer />} />
            {/* Jericho Sales Agent Landing Page */}
            <Route path="/sales-agent" element={<SalesAgentLanding />} />
            {/* Public Prep Document */}
            <Route path="/prep/:shareToken" element={<PublicPrepDocument />} />
            {/* AI Readiness Lead Gen Tool */}
            <Route path="/ai-readiness/*" element={<AIReadinessLanding />} />
            <Route path="/ai-readiness/report/:shareToken" element={<AIReadinessReport />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ViewAsProvider>
    </TooltipProvider>
  </QueryClientProvider>
  </HelmetProvider>
);

export default App;
