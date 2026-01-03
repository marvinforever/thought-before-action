import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Target, CheckCircle2, ArrowLeft, Users, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface DirectReport {
  id: string;
  full_name: string;
  role?: string;
}

interface FirstActionStepProps {
  directReports: DirectReport[];
  onStartOneOnOne: (employee: DirectReport) => void;
  onReviewCapabilities: (employee: DirectReport) => void;
  onManageTeam: () => void;
  onComplete: () => void;
  onBack: () => void;
}

type ActionType = "one-on-one" | "capabilities" | null;

export function FirstActionStep({
  directReports,
  onStartOneOnOne,
  onReviewCapabilities,
  onManageTeam,
  onComplete,
  onBack,
}: FirstActionStepProps) {
  const [selectedAction, setSelectedAction] = useState<ActionType>(null);
  const hasReports = directReports.length > 0;

  const handleEmployeeSelect = (employee: DirectReport) => {
    if (selectedAction === "one-on-one") {
      onStartOneOnOne(employee);
    } else if (selectedAction === "capabilities") {
      onReviewCapabilities(employee);
    }
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  // Show employee selection view
  if (selectedAction && hasReports) {
    return (
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-2"
        >
          <h2 className="text-2xl font-bold">
            {selectedAction === "one-on-one" ? "Start a 1:1 with..." : "Review capabilities for..."}
          </h2>
          <p className="text-muted-foreground">
            Select a team member to get started
          </p>
        </motion.div>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          <AnimatePresence>
            {directReports.map((employee, index) => (
              <motion.div
                key={employee.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card
                  className="p-4 cursor-pointer hover:shadow-md hover:border-primary/50 transition-all group"
                  onClick={() => handleEmployeeSelect(employee)}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {getInitials(employee.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="font-medium">{employee.full_name}</h3>
                      {employee.role && (
                        <p className="text-sm text-muted-foreground">{employee.role}</p>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="pt-2"
        >
          <Button variant="ghost" onClick={() => setSelectedAction(null)} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </motion.div>
      </div>
    );
  }

  // Main action selection view
  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-2"
      >
        <h2 className="text-2xl font-bold">Take Your First Action 🚀</h2>
        <p className="text-muted-foreground">
          The best way to learn is by doing. Pick one to get started:
        </p>
      </motion.div>

      {/* Action Options */}
      <div className="space-y-3">
        {/* Always show "Add team members" option first */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card
            className="p-5 cursor-pointer hover:shadow-md hover:border-primary/50 transition-all group"
            onClick={onManageTeam}
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/15 transition-colors">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">
                  {hasReports ? "Manage your team" : "Add your first team member"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {hasReports 
                    ? `You have ${directReports.length} direct report${directReports.length > 1 ? 's' : ''}. Add or remove team members.`
                    : "Assign direct reports so you can start 1:1s, reviews, and capability coaching."
                  }
                </p>
              </div>
              <div className="text-primary opacity-0 group-hover:opacity-100 transition-opacity">→</div>
            </div>
          </Card>
        </motion.div>

        {/* Show 1:1 and capabilities options only if they have reports */}
        {hasReports && (
          <>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card
                className="p-5 cursor-pointer hover:shadow-md hover:border-primary/50 transition-all group"
                onClick={() => setSelectedAction("one-on-one")}
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                    <MessageSquare className="h-6 w-6 text-blue-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">Start a 1:1</h3>
                    <p className="text-sm text-muted-foreground">
                      Begin a coaching conversation with a team member
                    </p>
                  </div>
                  <div className="text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    →
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card
                className="p-5 cursor-pointer hover:shadow-md hover:border-primary/50 transition-all group"
                onClick={() => setSelectedAction("capabilities")}
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
                    <Target className="h-6 w-6 text-emerald-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">Review Capabilities</h3>
                    <p className="text-sm text-muted-foreground">
                      See a team member's skill levels and growth areas
                    </p>
                  </div>
                  <div className="text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    →
                  </div>
                </div>
              </Card>
            </motion.div>
          </>
        )}

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: hasReports ? 0.4 : 0.2 }}
        >
          <Card
            className="p-5 cursor-pointer hover:shadow-md hover:border-primary/50 transition-all group"
            onClick={onComplete}
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-muted group-hover:bg-muted/80 transition-colors">
                <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">Explore on my own</h3>
                <p className="text-sm text-muted-foreground">
                  Jump into the dashboard and discover at your own pace
                </p>
              </div>
              <div className="text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                →
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Navigation */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="pt-2"
      >
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </motion.div>
    </div>
  );
}
