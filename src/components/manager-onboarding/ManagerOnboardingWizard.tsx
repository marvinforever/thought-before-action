import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { ManagerWelcomeStep } from "./ManagerWelcomeStep";
import { KeyActionsStep } from "./KeyActionsStep";
import { FirstActionStep } from "./FirstActionStep";

type WizardStep = "welcome" | "key-actions" | "first-action";

interface DirectReport {
  id: string;
  full_name: string;
  role?: string;
  company_id: string;
  email?: string;
}

interface ManagerOnboardingWizardProps {
  onStartOneOnOne?: (employee: DirectReport) => void;
  onViewCapabilities?: (employee: DirectReport) => void;
  onManageTeam?: () => void;
}

export function ManagerOnboardingWizard({
  onStartOneOnOne,
  onViewCapabilities,
  onManageTeam,
}: ManagerOnboardingWizardProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<WizardStep>("welcome");
  const [userName, setUserName] = useState("");
  const [directReports, setDirectReports] = useState<DirectReport[]>([]);

  useEffect(() => {
    checkIfShouldShow();
  }, []);

  const checkIfShouldShow = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if user is a manager
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["manager", "admin", "super_admin"]);

      if (rolesError || !roles || roles.length === 0) return;

      // Check if user has seen manager onboarding
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, has_seen_manager_onboarding")
        .eq("id", user.id)
        .single();

      // Cast to any to handle the new column that may not be in types yet
      const profileData = profile as any;
      if (profileData?.has_seen_manager_onboarding) return;

      // Load direct reports if any (new managers may have none yet)
      const { data: assignments } = await supabase
        .from("manager_assignments")
        .select(`
          employee:profiles!manager_assignments_employee_id_fkey (
            id,
            full_name,
            role,
            company_id,
            email
          )
        `)
        .eq("manager_id", user.id);

      setUserName(profileData?.full_name?.split(" ")[0] || "");
      setDirectReports(
        (assignments || [])
          .map((a: any) => a.employee)
          .filter(Boolean) as DirectReport[]
      );

      setOpen(true);
    } catch (error) {
      console.error("Error checking manager onboarding:", error);
    }
  };

  const markOnboardingComplete = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Cast to any to handle the new column
      await supabase
        .from("profiles")
        .update({ has_seen_manager_onboarding: true } as any)
        .eq("id", user.id);
    } catch (error) {
      console.error("Error marking onboarding complete:", error);
    }
  };

  const handleClose = () => {
    setOpen(false);
    markOnboardingComplete();
  };

  const handleStartOneOnOne = (employee: DirectReport) => {
    handleClose();
    onStartOneOnOne?.(employee);
  };

  const handleViewCapabilities = (employee: DirectReport) => {
    handleClose();
    onViewCapabilities?.(employee);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md p-6 overflow-y-auto max-h-[90vh]">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {step === "welcome" && (
              <ManagerWelcomeStep
                userName={userName}
                teamSize={directReports.length}
                onContinue={() => setStep("key-actions")}
                onSkip={handleClose}
              />
            )}
            {step === "key-actions" && (
              <KeyActionsStep
                onContinue={() => setStep("first-action")}
                onBack={() => setStep("welcome")}
              />
            )}
            {step === "first-action" && (
              <FirstActionStep
                directReports={directReports}
                onStartOneOnOne={handleStartOneOnOne}
                onReviewCapabilities={handleViewCapabilities}
                onManageTeam={() => {
                  handleClose();
                  onManageTeam?.();
                }}
                onComplete={handleClose}
                onBack={() => setStep("key-actions")}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
