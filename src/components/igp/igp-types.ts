export interface IGPProfile {
  full_name: string;
  job_title?: string;
  company_name?: string;
}

export interface IGPCapability {
  name: string;
  category: string;
  description: string;
  current_level: string;
  target_level: string;
  self_assessed: string | null;
  priority: number | null;
  remaining_levels: Array<{ level: string; definition: string }>;
  level_definitions: Record<string, string>;
}

export interface IGPDiagnostic {
  engagement_score: number | null;
  clarity_score: number | null;
  career_score: number | null;
  learning_score: number | null;
  manager_score: number | null;
  skills_score: number | null;
  retention_score: number | null;
  burnout_score: number | null;
}

export interface IGPTrainingItem {
  type: "book" | "video" | "podcast" | "course" | "exercise" | "mentorship" | "tool";
  title: string;
  description: string;
  target_level: string;
  cost_indicator: "free" | "paid";
  cost_detail?: string;
  free_alternative?: string;
}

export interface IGPLevelProgression {
  level: string;
  definition: string;
  how_to_achieve: string;
}

export interface IGPRecommendation {
  capability_name: string;
  current_assessment: string;
  why_this_matters: string;
  advancement_approach: "natural" | "training_needed" | "mixed";
  advancement_reasoning: string;
  estimated_timeline: string;
  training_items: IGPTrainingItem[];
  level_progression: IGPLevelProgression[];
  is_top_priority?: boolean;
}

export interface IGPAIRecommendations {
  recommendations: IGPRecommendation[];
  overall_summary: string;
  strengths_statement: string;
  primary_development_focus: string;
  top_priority_actions: Array<{
    action: string;
    capability_name: string;
  }>;
  roadmap: {
    month_1: Array<{ action: string; capability: string; resource_type: string; time_per_week: string }>;
    month_2_3: Array<{ action: string; capability: string; resource_type: string; time_per_week: string }>;
    month_3_plus: Array<{ action: string; capability: string; resource_type: string; time_per_week: string }>;
  };
  at_a_glance: {
    total_capabilities: number;
    by_level: Record<string, number>;
    gap_1_count: number;
    gap_2_plus_count: number;
    on_target_count: number;
  };
}

export interface IGPGoal {
  goal_text: string | null;
  category: string;
  completed: boolean;
  by_when: string | null;
}

export interface IGPHabit {
  habit_name: string;
  target_frequency: string;
  current_streak: number;
}

export interface IGPAchievement {
  achievement_text: string;
  achieved_date: string | null;
}

export interface IGPVision {
  one_year_vision: string | null;
  three_year_vision: string | null;
}

export interface IGPData {
  profile: IGPProfile;
  capabilities: IGPCapability[];
  diagnostic: IGPDiagnostic | null;
  vision: IGPVision | null;
  goals: IGPGoal[] | null;
  habits: IGPHabit[] | null;
  achievements: IGPAchievement[] | null;
  ai_recommendations: IGPAIRecommendations;
  generated_at: string;
}

export function levelToNumber(level: string | null | undefined): number {
  switch (level) {
    case "mastery": return 4;
    case "independent": return 3;
    case "advancing": return 2;
    case "foundational": return 1;
    default: return 0;
  }
}

export function formatLevel(level: string | null | undefined): string {
  if (!level) return "Not Assessed";
  const map: Record<string, string> = {
    foundational: "Level 1",
    advancing: "Level 2",
    independent: "Level 3",
    mastery: "Level 4",
  };
  return map[level.toLowerCase()] || "Level 1";
}

export function getGap(current: string, target: string): number {
  return levelToNumber(target) - levelToNumber(current);
}

export const RESOURCE_TYPE_CONFIG: Record<string, { label: string; color: string; bgColor: string; pdfColor: readonly [number, number, number] }> = {
  book: { label: "Book", color: "text-amber-700 dark:text-amber-400", bgColor: "bg-amber-100 dark:bg-amber-900/30", pdfColor: [180, 120, 20] },
  course: { label: "Course", color: "text-purple-700 dark:text-purple-400", bgColor: "bg-purple-100 dark:bg-purple-900/30", pdfColor: [120, 50, 180] },
  video: { label: "Video", color: "text-red-700 dark:text-red-400", bgColor: "bg-red-100 dark:bg-red-900/30", pdfColor: [200, 50, 50] },
  exercise: { label: "Practice", color: "text-green-700 dark:text-green-400", bgColor: "bg-green-100 dark:bg-green-900/30", pdfColor: [22, 140, 70] },
  mentorship: { label: "Mentorship", color: "text-blue-700 dark:text-blue-400", bgColor: "bg-blue-100 dark:bg-blue-900/30", pdfColor: [37, 99, 235] },
  podcast: { label: "Podcast", color: "text-pink-700 dark:text-pink-400", bgColor: "bg-pink-100 dark:bg-pink-900/30", pdfColor: [190, 50, 120] },
  tool: { label: "Tool", color: "text-slate-700 dark:text-slate-400", bgColor: "bg-slate-100 dark:bg-slate-900/30", pdfColor: [80, 90, 100] },
};

export const LEVEL_COLORS: Record<string, { text: string; bg: string; pdfBg: readonly [number, number, number]; pdfText: readonly [number, number, number] }> = {
  foundational: { text: "text-slate-700 dark:text-slate-300", bg: "bg-slate-200 dark:bg-slate-700", pdfBg: [200, 205, 215], pdfText: [60, 70, 85] },
  advancing: { text: "text-amber-700 dark:text-amber-300", bg: "bg-amber-200 dark:bg-amber-800", pdfBg: [255, 230, 150], pdfText: [140, 90, 0] },
  independent: { text: "text-blue-700 dark:text-blue-300", bg: "bg-blue-200 dark:bg-blue-800", pdfBg: [180, 210, 255], pdfText: [30, 70, 180] },
  mastery: { text: "text-green-700 dark:text-green-300", bg: "bg-green-200 dark:bg-green-800", pdfBg: [180, 240, 200], pdfText: [20, 120, 60] },
};
