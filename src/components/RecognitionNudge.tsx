import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Award, X, ChevronRight, Lightbulb } from "lucide-react";

interface RecognitionNudgeProps {
  onRecognize: (employee: { id: string; full_name: string; company_id: string }) => void;
}

interface NudgeSuggestion {
  type: "no_recent" | "goal_completed" | "random";
  employee: {
    id: string;
    full_name: string;
    company_id: string;
  };
  reason: string;
}

export function RecognitionNudge({ onRecognize }: RecognitionNudgeProps) {
  const [suggestion, setSuggestion] = useState<NudgeSuggestion | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSuggestion();
  }, []);

  const loadSuggestion = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get direct reports
      const { data: assignments } = await supabase
        .from("manager_assignments")
        .select("employee:profiles!manager_assignments_employee_id_fkey(id, full_name, company_id)")
        .eq("manager_id", user.id);

      const directReports = assignments?.map((a: any) => a.employee).filter(Boolean) || [];

      if (directReports.length === 0) {
        setLoading(false);
        return;
      }

      const directReportIds = directReports.map((dr: any) => dr.id);

      // Check for employees without recent recognition (last 14 days)
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      const { data: recentRecognitions } = await supabase
        .from("recognition_notes")
        .select("given_to")
        .eq("given_by", user.id)
        .in("given_to", directReportIds)
        .gte("created_at", twoWeeksAgo.toISOString());

      const recognizedIds = new Set(recentRecognitions?.map((r) => r.given_to) || []);
      const notRecentlyRecognized = directReports.filter(
        (dr: any) => !recognizedIds.has(dr.id)
      );

      if (notRecentlyRecognized.length > 0) {
        // Prioritize employees not recognized
        const randomUnrecognized = notRecentlyRecognized[
          Math.floor(Math.random() * notRecentlyRecognized.length)
        ];
        setSuggestion({
          type: "no_recent",
          employee: randomUnrecognized,
          reason: `You haven't recognized ${randomUnrecognized.full_name} in a while`,
        });
      } else {
        // Everyone has been recognized recently, maybe suggest random for engagement
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const { data: veryRecentRecognitions } = await supabase
          .from("recognition_notes")
          .select("given_to")
          .eq("given_by", user.id)
          .in("given_to", directReportIds)
          .gte("created_at", oneWeekAgo.toISOString());

        const veryRecentIds = new Set(veryRecentRecognitions?.map((r) => r.given_to) || []);
        const notThisWeek = directReports.filter(
          (dr: any) => !veryRecentIds.has(dr.id)
        );

        if (notThisWeek.length > 0) {
          const randomEmployee = notThisWeek[
            Math.floor(Math.random() * notThisWeek.length)
          ];
          setSuggestion({
            type: "random",
            employee: randomEmployee,
            reason: `Consider celebrating a recent win with ${randomEmployee.full_name}`,
          });
        }
      }
    } catch (error) {
      console.error("Error loading recognition suggestion:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  const handleRecognize = () => {
    if (suggestion) {
      onRecognize(suggestion.employee);
      setDismissed(true);
    }
  };

  if (loading || !suggestion || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <Card className="bg-gradient-to-r from-amber-500/10 to-primary/10 border-amber-500/20">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-amber-500/20">
                  <Lightbulb className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">{suggestion.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    Recognition builds culture & combats recency bias
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={handleDismiss}>
                  <X className="h-4 w-4" />
                </Button>
                <Button size="sm" onClick={handleRecognize}>
                  <Award className="h-4 w-4 mr-1" />
                  Recognize
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
