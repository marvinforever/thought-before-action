import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface PromotionReadiness {
  id: string;
  profile_id: string;
  target_role: string;
  overall_readiness_pct: number | null;
  capability_readiness_pct: number | null;
  experience_readiness_pct: number | null;
  performance_readiness_pct: number | null;
  capability_gaps: any[];
  strengths: any[];
  readiness_summary: string | null;
  recommended_actions: any[];
  estimated_ready_date: string | null;
  assessed_at: string | null;
}

export interface CareerPath {
  id: string;
  name: string;
  description: string | null;
  path_type: string;
  from_role: string | null;
  to_role: string;
  typical_timeline_months: number | null;
  required_capabilities: any;
  is_active: boolean;
}

export interface CareerAspiration {
  id: string;
  aspiration_text: string;
  aspiration_type: string;
  target_role: string | null;
  confidence_score: number | null;
  sentiment: string | null;
  created_at: string;
}

export interface CareerRoadmap {
  targetRole: string;
  readinessScore: number;
  capabilityAnalysis: string;
  aspirationSummary: string;
  targetRoles: string[];
  gaps: any[];
  strengths: any[];
  roadmap: {
    roadmap?: {
      phase1?: RoadmapPhase;
      phase2?: RoadmapPhase;
      phase3?: RoadmapPhase;
      phase4?: RoadmapPhase;
    };
    readiness_breakdown?: {
      capability_coverage: number;
      gap_severity_score: number;
      track_record_score: number;
      consistency_score: number;
    };
    estimated_ready_date?: string;
    summary?: string;
  };
  suggestedPaths: string[];
}

interface RoadmapPhase {
  name: string;
  duration_days: number;
  focus_capabilities: string[];
  milestones: Array<{
    milestone: string;
    measurable: string;
    target_date_offset_days: number;
  }>;
  resources: string[];
}

export function useCareerPath() {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [readiness, setReadiness] = useState<PromotionReadiness | null>(null);
  const [careerPaths, setCareerPaths] = useState<CareerPath[]>([]);
  const [aspirations, setAspirations] = useState<CareerAspiration[]>([]);
  const [roadmap, setRoadmap] = useState<CareerRoadmap | null>(null);
  const { toast } = useToast();

  const loadPromotionReadiness = async (profileId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("promotion_readiness")
        .select("*")
        .eq("profile_id", profileId)
        .order("assessed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      // Parse JSON fields
      if (data) {
        setReadiness({
          ...data,
          capability_gaps: Array.isArray(data.capability_gaps) ? data.capability_gaps : [],
          strengths: Array.isArray(data.strengths) ? data.strengths : [],
          recommended_actions: Array.isArray(data.recommended_actions) ? data.recommended_actions : [],
        });
      }
    } catch (error: any) {
      console.error("Error loading promotion readiness:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadCareerPaths = async (companyId: string) => {
    try {
      const { data, error } = await supabase
        .from("career_paths")
        .select("*")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setCareerPaths(data || []);
    } catch (error: any) {
      console.error("Error loading career paths:", error);
    }
  };

  const loadAspirations = async (profileId: string) => {
    try {
      const { data, error } = await supabase
        .from("career_aspirations")
        .select("*")
        .eq("profile_id", profileId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      setAspirations(data || []);
    } catch (error: any) {
      console.error("Error loading aspirations:", error);
    }
  };

  const generateCareerPath = async (
    employeeId: string,
    targetRole?: string,
    wizardData?: {
      aspirations?: string;
      selfAssessment?: {
        technicalSkills: number;
        leadership: number;
        communication: number;
        experience: number;
      };
      timeline?: string;
    }
  ) => {
    try {
      setGenerating(true);
      
      const { data, error } = await supabase.functions.invoke("generate-career-path", {
        body: { 
          employeeId, 
          targetRole,
          aspirations: wizardData?.aspirations,
          selfAssessment: wizardData?.selfAssessment,
          targetTimeline: wizardData?.timeline ? parseInt(wizardData.timeline) : undefined,
        },
      });

      if (error) throw error;

      if (data?.success) {
        setRoadmap(data);
        toast({
          title: "Career path generated",
          description: `Readiness score: ${data.readinessScore}%`,
        });
        
        // Reload the promotion readiness data
        await loadPromotionReadiness(employeeId);
        
        return data;
      } else {
        throw new Error(data?.error || "Failed to generate career path");
      }
    } catch (error: any) {
      console.error("Error generating career path:", error);
      toast({
        title: "Failed to generate career path",
        description: error.message,
        variant: "destructive",
      });
      return null;
    } finally {
      setGenerating(false);
    }
  };

  return {
    loading,
    generating,
    readiness,
    careerPaths,
    aspirations,
    roadmap,
    loadPromotionReadiness,
    loadCareerPaths,
    loadAspirations,
    generateCareerPath,
  };
}
