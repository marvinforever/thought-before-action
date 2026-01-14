import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Target, Plus, Check, Trash2, Sparkles, Loader2, MessageSquare, LayoutGrid, Layers, Square, CheckSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import TargetBreakdownDialog from "./TargetBreakdownDialog";

type BenchmarkItem = {
  id: string;
  text: string;
  completed: boolean;
  completedAt?: string;
};

type SprintItem = {
  id: string;
  text: string;
  completed: boolean;
  completedAt?: string;
};

type BenchmarksJson = any;

type SprintsJson = any;

type NinetyDayTarget = {
  id: string;
  quarter: string;
  year: number;
  category: string;
  goal_number: number;
  goal_text: string | null;
  by_when: string | null;
  support_needed: string | null;
  completed: boolean;
  benchmarks: BenchmarksJson;
  sprints: SprintsJson;
};
const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];

// Helper function to get current quarter
const getCurrentQuarter = () => {
  const month = new Date().getMonth(); // 0-11
  if (month < 3) return "Q1";
  if (month < 6) return "Q2";
  if (month < 9) return "Q3";
  return "Q4";
};

// Helper function to get available years
const getAvailableYears = () => {
  const currentYear = new Date().getFullYear();
  const startYear = 2024; // Or whenever the app started
  const futureYears = 5; // Allow planning 5 years ahead
  const years = [];
  // Add future years first (descending)
  for (let year = currentYear + futureYears; year >= currentYear; year--) {
    years.push(year);
  }
  // Add past years
  for (let year = currentYear - 1; year >= startYear; year--) {
    years.push(year);
  }
  return years;
};

export default function NinetyDayTracker() {
  const [targets, setTargets] = useState<NinetyDayTarget[]>([]);
  const [selectedQuarter, setSelectedQuarter] = useState(() => getCurrentQuarter());
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [viewMode, setViewMode] = useState<"stacked" | "columns">("stacked");
  const [editingGoal, setEditingGoal] = useState<{
    quarter: string;
    category: string;
    number: number;
  } | null>(null);
  const [breakdownDialogOpen, setBreakdownDialogOpen] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<any>(null);
  const [formData, setFormData] = useState({
    goalText: "",
    byWhen: "",
    supportNeeded: "",
    benchmarks: "",
    sprints: ""
  });
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [aiSuggestionBenchmarks, setAiSuggestionBenchmarks] = useState("");
  const [isLoadingAiBenchmarks, setIsLoadingAiBenchmarks] = useState(false);
  const [aiSuggestionSprints, setAiSuggestionSprints] = useState("");
  const [isLoadingAiSprints, setIsLoadingAiSprints] = useState(false);
  const [addNewItemDialog, setAddNewItemDialog] = useState<{
    targetId: string;
    type: 'benchmark' | 'sprint';
    target: NinetyDayTarget;
  } | null>(null);
  const [newItemText, setNewItemText] = useState("");
  const {
    toast
  } = useToast();

  // Reset to current quarter/year on mount
  useEffect(() => {
    setSelectedQuarter(getCurrentQuarter());
    setSelectedYear(new Date().getFullYear());
  }, []);

  useEffect(() => {
    loadTargets();
  }, [selectedYear]);

  const normalizeTarget = (t: any): NinetyDayTarget => {
    const normalizeJsonList = (
      value: any,
      prefix: 'b' | 's'
    ): { items: (BenchmarkItem | SprintItem)[] } | null => {
      if (!Array.isArray(value)) return null;
      const items = value
        .map((it: any, idx: number) => ({
          id: `legacy-${prefix}-${idx}`,
          text: String(it?.text ?? '').trim(),
          completed: Boolean(it?.completed),
        }))
        .filter((it: any) => it.text.length > 0);
      return items.length ? { items: items as any } : null;
    };

    const normalizedBenchmarks = Array.isArray(t?.benchmarks)
      ? normalizeJsonList(t.benchmarks, 'b')
      : t?.benchmarks ?? null;

    const normalizedSprints = Array.isArray(t?.sprints)
      ? normalizeJsonList(t.sprints, 's')
      : t?.sprints ?? null;

    return {
      ...(t as NinetyDayTarget),
      benchmarks: normalizedBenchmarks,
      sprints: normalizedSprints,
    };
  };

  const loadTargets = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("ninety_day_targets")
        .select("*")
        .eq("profile_id", user.id)
        .eq("year", selectedYear)
        .order("goal_number", {
          ascending: true,
        });

      if (error) throw error;

      const normalized = (data || []).map(normalizeTarget);
      setTargets(normalized);
    } catch (error: any) {
      console.error("Error loading targets:", error);
    }
  };
  const getTargetsForQuarter = (quarter: string, category: string) => {
    // Get all existing targets for this quarter and category
    const existingTargets = targets.filter(t => t.quarter === quarter && t.category === category);
    
    // Determine how many goal slots to show (at least 3, or enough to fit all existing + 1 empty)
    const maxGoalNumber = existingTargets.length > 0 
      ? Math.max(...existingTargets.map(t => t.goal_number || 0), 3) + 1
      : 3;
    
    return Array.from({ length: maxGoalNumber }, (_, i) => i + 1).map(num => {
      const existing = existingTargets.find(t => t.goal_number === num);
      return existing || {
        quarter,
        category,
        goal_number: num,
        goal_text: null,
        by_when: null,
        support_needed: null,
        completed: false,
        benchmarks: null,
        sprints: null
      };
    });
  };
  const handleSaveGoal = async (quarter: string, category: string, goalNumber: number) => {
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .maybeSingle();
      if (!profile) throw new Error("Profile not found");
      const payload = {
        profile_id: user.id,
        company_id: profile.company_id,
        quarter,
        year: selectedYear,
        category,
        goal_type: category, // UI lanes: personal | professional
        goal_number: goalNumber,
        goal_text: formData.goalText || null,
        by_when: formData.byWhen || null,
        support_needed: formData.supportNeeded || null,
        benchmarks: formData.benchmarks ? { text: formData.benchmarks } : null,
        sprints: formData.sprints ? { text: formData.sprints } : null
      };
      const {
        error
      } = await supabase.from("ninety_day_targets").upsert(payload, {
        onConflict: 'profile_id,quarter,year,category,goal_number'
      });
      if (error) throw error;
      
      // Award points for goal creation (only for new goals with text)
      if (formData.goalText) {
        await supabase.rpc('award_points', {
          p_profile_id: user.id,
          p_activity_type: 'goal_created',
          p_description: `Created ${quarter} ${category} goal`
        });
      }
      
      toast({
        title: "Goal saved",
        description: "Your 90-day target has been updated"
      });
      setEditingGoal(null);
      setFormData({
        goalText: "",
        byWhen: "",
        supportNeeded: "",
        benchmarks: "",
        sprints: ""
      });
      await loadTargets();
    } catch (error: any) {
      toast({
        title: "Error saving goal",
        description: error.message,
        variant: "destructive"
      });
    }
  };
  const handleToggleComplete = async (target: NinetyDayTarget) => {
    try {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      
      const {
        error
      } = await supabase.from("ninety_day_targets").update({
        completed: !target.completed
      }).eq("id", target.id);
      if (error) throw error;
      
      // Award points when goal is completed (not uncompleted)
      if (!target.completed && user) {
        await supabase.rpc('award_points', {
          p_profile_id: user.id,
          p_activity_type: 'goal_completed',
          p_description: `Completed: ${target.goal_text?.substring(0, 50) || 'Goal'}`
        });
      }
      
      await loadTargets();
    } catch (error: any) {
      toast({
        title: "Error updating goal",
        description: error.message,
        variant: "destructive"
      });
    }
  };
  const handleDeleteGoal = async (target: NinetyDayTarget) => {
    try {
      const {
        error
      } = await supabase.from("ninety_day_targets").delete().eq("id", target.id);
      if (error) throw error;
      toast({
        title: "Goal deleted",
        description: "Your 90-day target has been removed"
      });
      await loadTargets();
    } catch (error: any) {
      toast({
        title: "Error deleting goal",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // Toggle benchmark item completion
  const handleToggleBenchmark = async (target: NinetyDayTarget, itemId: string) => {
    try {
      const items = target.benchmarks?.items || [];
      const updatedItems = items.map(item => 
        item.id === itemId 
          ? { ...item, completed: !item.completed, completedAt: !item.completed ? new Date().toISOString() : undefined }
          : item
      );
      
      const { error } = await supabase
        .from("ninety_day_targets")
        .update({ benchmarks: { ...target.benchmarks, items: updatedItems } })
        .eq("id", target.id);
      
      if (error) throw error;

      // Check if this was a completion - prompt to add new
      const toggledItem = items.find(i => i.id === itemId);
      if (toggledItem && !toggledItem.completed) {
        toast({
          title: "Benchmark completed! 🎉",
          description: "Great progress! Add your next benchmark.",
        });
        setAddNewItemDialog({ targetId: target.id, type: 'benchmark', target });
      }
      
      await loadTargets();
    } catch (error: any) {
      toast({
        title: "Error updating benchmark",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // Toggle sprint item completion
  const handleToggleSprint = async (target: NinetyDayTarget, itemId: string) => {
    try {
      const items = target.sprints?.items || [];
      const updatedItems = items.map(item => 
        item.id === itemId 
          ? { ...item, completed: !item.completed, completedAt: !item.completed ? new Date().toISOString() : undefined }
          : item
      );
      
      const { error } = await supabase
        .from("ninety_day_targets")
        .update({ sprints: { ...target.sprints, items: updatedItems } })
        .eq("id", target.id);
      
      if (error) throw error;

      // Check if this was a completion - prompt to add new
      const toggledItem = items.find(i => i.id === itemId);
      if (toggledItem && !toggledItem.completed) {
        toast({
          title: "Sprint completed! 🎉",
          description: "Momentum! Add your next 7-day sprint.",
        });
        setAddNewItemDialog({ targetId: target.id, type: 'sprint', target });
      }
      
      await loadTargets();
    } catch (error: any) {
      toast({
        title: "Error updating sprint",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // Add a new benchmark or sprint item
  const handleAddNewItem = async () => {
    if (!addNewItemDialog || !newItemText.trim()) return;
    
    try {
      const { target, type } = addNewItemDialog;
      const newItem = {
        id: crypto.randomUUID(),
        text: newItemText.trim(),
        completed: false,
      };

      if (type === 'benchmark') {
        const existingItems = target.benchmarks?.items || [];
        const { error } = await supabase
          .from("ninety_day_targets")
          .update({ benchmarks: { ...target.benchmarks, items: [...existingItems, newItem] } })
          .eq("id", target.id);
        if (error) throw error;
      } else {
        const existingItems = target.sprints?.items || [];
        const { error } = await supabase
          .from("ninety_day_targets")
          .update({ sprints: { ...target.sprints, items: [...existingItems, newItem] } })
          .eq("id", target.id);
        if (error) throw error;
      }

      toast({
        title: type === 'benchmark' ? "Benchmark added!" : "Sprint added!",
        description: "Keep building momentum!",
      });
      
      setNewItemText("");
      setAddNewItemDialog(null);
      await loadTargets();
    } catch (error: any) {
      toast({
        title: "Error adding item",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // Convert text-based benchmarks/sprints to items (migration helper)
  const convertTextToItems = async (target: NinetyDayTarget, type: 'benchmark' | 'sprint') => {
    try {
      const text = type === 'benchmark' ? target.benchmarks?.text : target.sprints?.text;
      if (!text) return;

      const newItem = {
        id: crypto.randomUUID(),
        text: text.trim(),
        completed: false,
      };

      if (type === 'benchmark') {
        const { error } = await supabase
          .from("ninety_day_targets")
          .update({ benchmarks: { items: [newItem] } })
          .eq("id", target.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ninety_day_targets")
          .update({ sprints: { items: [newItem] } })
          .eq("id", target.id);
        if (error) throw error;
      }
      
      await loadTargets();
    } catch (error: any) {
      console.error("Error converting to items:", error);
    }
  };
  const startEditing = (quarter: string, category: string, goalNumber: number, existing?: any) => {
    setEditingGoal({
      quarter,
      category,
      number: goalNumber,
    });

    const listToText = (v: any) => {
      if (Array.isArray(v)) {
        return v
          .map((x: any) => String(x?.text ?? '').trim())
          .filter(Boolean)
          .join("\n");
      }
      const items = v?.items;
      if (Array.isArray(items)) {
        return items
          .map((x: any) => String(x?.text ?? '').trim())
          .filter(Boolean)
          .join("\n");
      }
      return String(v?.text ?? '');
    };

    if (existing && existing.goal_text) {
      setFormData({
        goalText: existing.goal_text || "",
        byWhen: existing.by_when || "",
        supportNeeded: existing.support_needed || "",
        benchmarks: listToText(existing.benchmarks),
        sprints: listToText(existing.sprints),
      });
    } else {
      setFormData({
        goalText: "",
        byWhen: "",
        supportNeeded: "",
        benchmarks: "",
        sprints: "",
      });
    }
    setAiSuggestion("");
    setAiSuggestionBenchmarks("");
    setAiSuggestionSprints("");
  };

  const handleGetAiHelp = async (type: 'goal' | 'benchmarks' | 'sprints' = 'goal') => {
    if (!editingGoal) return;
    
    if (type === 'goal') {
      setIsLoadingAi(true);
      setAiSuggestion("");
    } else if (type === 'benchmarks') {
      setIsLoadingAiBenchmarks(true);
      setAiSuggestionBenchmarks("");
    } else if (type === 'sprints') {
      setIsLoadingAiSprints(true);
      setAiSuggestionSprints("");
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/help-write-goal`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            draftGoal: formData.goalText,
            category: editingGoal.category,
            quarter: editingGoal.quarter,
            type,
          }),
        }
      );

      if (!response.ok || !response.body) {
        throw new Error('Failed to get AI help');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              if (type === 'goal') {
                setAiSuggestion(prev => prev + content);
              } else if (type === 'benchmarks') {
                setAiSuggestionBenchmarks(prev => prev + content);
              } else if (type === 'sprints') {
                setAiSuggestionSprints(prev => prev + content);
              }
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              if (type === 'goal') {
                setAiSuggestion(prev => prev + content);
              } else if (type === 'benchmarks') {
                setAiSuggestionBenchmarks(prev => prev + content);
              } else if (type === 'sprints') {
                setAiSuggestionSprints(prev => prev + content);
              }
            }
          } catch { /* ignore partial leftovers */ }
        }
      }
    } catch (error: any) {
      console.error('Error getting AI help:', error);
      toast({
        title: 'Error',
        description: 'Failed to get AI assistance. Please try again.',
        variant: 'destructive',
      });
    } finally {
      if (type === 'goal') {
        setIsLoadingAi(false);
      } else if (type === 'benchmarks') {
        setIsLoadingAiBenchmarks(false);
      } else if (type === 'sprints') {
        setIsLoadingAiSprints(false);
      }
    }
  };

  const handleUseAiSuggestion = () => {
    setFormData(prev => ({
      ...prev,
      goalText: aiSuggestion,
    }));
    setAiSuggestion("");
  };

  const handleUseAiSuggestionBenchmarks = () => {
    setFormData(prev => ({
      ...prev,
      benchmarks: aiSuggestionBenchmarks,
    }));
    setAiSuggestionBenchmarks("");
  };

  const handleUseAiSuggestionSprints = () => {
    setFormData(prev => ({
      ...prev,
      sprints: aiSuggestionSprints,
    }));
    setAiSuggestionSprints("");
  };
  const renderGoalCard = (goal: any, quarter: string, category: string) => {
    const isEditing = editingGoal?.quarter === quarter && editingGoal?.category === category && editingGoal?.number === goal.goal_number;
    if (isEditing) {
      return <Card key={`${quarter}-${category}-${goal.goal_number}`} className="border-primary">
          <CardContent className="pt-4 space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium">Goal {goal.goal_number}</label>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => handleGetAiHelp('goal')}
                  disabled={isLoadingAi}
                  className="text-xs h-7"
                >
                  {isLoadingAi ? (
                    <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Writing...</>
                  ) : (
                    <><Sparkles className="h-3 w-3 mr-1" /> Get Help Writing</>
                  )}
                </Button>
              </div>
              <Textarea value={formData.goalText} onChange={e => setFormData({
              ...formData,
              goalText: e.target.value
            })} placeholder="What do you want to accomplish?" className="min-h-[80px]" />
            </div>

            {(aiSuggestion || isLoadingAi) && (
              <div className="bg-muted rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3 w-3 text-primary" />
                  <span className="text-xs font-medium">Jericho suggests:</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">
                  {aiSuggestion || (
                    <span className="inline-flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Thinking...
                    </span>
                  )}
                </p>
                {aiSuggestion && (
                  <Button size="sm" variant="outline" onClick={handleUseAiSuggestion}>
                    Use This Goal
                  </Button>
                )}
              </div>
            )}

            <div>
              <label className="text-xs font-medium mb-1 block">By When?</label>
              <Input type="date" value={formData.byWhen} onChange={e => setFormData({
              ...formData,
              byWhen: e.target.value
            })} />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Support Needed?</label>
              <Textarea value={formData.supportNeeded} onChange={e => setFormData({
              ...formData,
              supportNeeded: e.target.value
            })} placeholder="What help do you need?" className="min-h-[60px]" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium">30 Day Benchmarks</label>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => handleGetAiHelp('benchmarks')}
                  disabled={isLoadingAiBenchmarks}
                  className="text-xs h-7"
                >
                  {isLoadingAiBenchmarks ? (
                    <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Writing...</>
                  ) : (
                    <><Sparkles className="h-3 w-3 mr-1" /> Get Help</>
                  )}
                </Button>
              </div>
              <Textarea value={formData.benchmarks} onChange={e => setFormData({
              ...formData,
              benchmarks: e.target.value
            })} placeholder="What should you accomplish in 30 days?" className="min-h-[60px]" />
            </div>

            {(aiSuggestionBenchmarks || isLoadingAiBenchmarks) && (
              <div className="bg-muted rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3 w-3 text-primary" />
                  <span className="text-xs font-medium">Jericho suggests:</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">
                  {aiSuggestionBenchmarks || (
                    <span className="inline-flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Thinking...
                    </span>
                  )}
                </p>
                {aiSuggestionBenchmarks && (
                  <Button size="sm" variant="outline" onClick={handleUseAiSuggestionBenchmarks}>
                    Use These Benchmarks
                  </Button>
                )}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium">Next 7 Day Sprint</label>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => handleGetAiHelp('sprints')}
                  disabled={isLoadingAiSprints}
                  className="text-xs h-7"
                >
                  {isLoadingAiSprints ? (
                    <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Writing...</>
                  ) : (
                    <><Sparkles className="h-3 w-3 mr-1" /> Get Help</>
                  )}
                </Button>
              </div>
              <Textarea value={formData.sprints} onChange={e => setFormData({
              ...formData,
              sprints: e.target.value
            })} placeholder="What will you do in the next 7 days?" className="min-h-[60px]" />
            </div>

            {(aiSuggestionSprints || isLoadingAiSprints) && (
              <div className="bg-muted rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3 w-3 text-primary" />
                  <span className="text-xs font-medium">Jericho suggests:</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">
                  {aiSuggestionSprints || (
                    <span className="inline-flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Thinking...
                    </span>
                  )}
                </p>
                {aiSuggestionSprints && (
                  <Button size="sm" variant="outline" onClick={handleUseAiSuggestionSprints}>
                    Use This Sprint Plan
                  </Button>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleSaveGoal(quarter, category, goal.goal_number)}>
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditingGoal(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>;
    }
    if (!goal.goal_text && !goal.id) {
      return <Card key={`${quarter}-${category}-${goal.goal_number}`} className="border-dashed cursor-pointer hover:border-primary" onClick={() => startEditing(quarter, category, goal.goal_number)}>
          <CardContent className="pt-4 flex items-center justify-center min-h-[120px]">
            <Button variant="ghost" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Target {goal.goal_number}
            </Button>
          </CardContent>
        </Card>;
    }
    return <Card key={goal.id || `${quarter}-${category}-${goal.goal_number}`} className={goal.completed ? "bg-muted/50" : ""}>
        <CardContent className="pt-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">Goal {goal.goal_number}</span>
                {goal.completed && <Badge variant="secondary" className="text-xs">Complete</Badge>}
              </div>
              <p className={`text-sm leading-relaxed ${goal.completed ? "line-through text-muted-foreground" : ""}`}>
                {goal.goal_text}
              </p>
              {goal.support_needed && <p className="text-xs text-muted-foreground italic">
                  Support: {goal.support_needed}
                </p>}
              {/* Benchmarks Section */}
              {(goal.benchmarks?.items?.length > 0 || goal.benchmarks?.text) && (
                <div className="mt-3 p-2 bg-muted/50 rounded-md">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-muted-foreground">30 Day Benchmarks:</p>
                    {goal.id && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 text-xs"
                        onClick={() => setAddNewItemDialog({ targetId: goal.id, type: 'benchmark', target: goal })}
                      >
                        <Plus className="h-3 w-3 mr-1" /> Add
                      </Button>
                    )}
                  </div>
                  {goal.benchmarks?.items?.length > 0 ? (
                    <div className="space-y-1">
                      {goal.benchmarks.items.map((item: BenchmarkItem) => (
                        <div 
                          key={item.id} 
                          className="flex items-start gap-2 cursor-pointer hover:bg-muted/70 rounded p-1 -m-1"
                          onClick={() => handleToggleBenchmark(goal, item.id)}
                        >
                          {item.completed ? (
                            <CheckSquare className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                          )}
                          <span className={`text-xs ${item.completed ? 'line-through text-muted-foreground' : ''}`}>
                            {item.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : goal.benchmarks?.text ? (
                    <div 
                      className="text-xs cursor-pointer hover:bg-muted/70 rounded p-1 -m-1"
                      onClick={() => convertTextToItems(goal, 'benchmark')}
                      title="Click to make checkable"
                    >
                      {goal.benchmarks.text}
                    </div>
                  ) : null}
                </div>
              )}
              {/* Sprints Section */}
              {(goal.sprints?.items?.length > 0 || goal.sprints?.text) && (
                <div className="mt-2 p-2 bg-accent/10 rounded-md">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-muted-foreground">7 Day Sprints:</p>
                    {goal.id && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 text-xs"
                        onClick={() => setAddNewItemDialog({ targetId: goal.id, type: 'sprint', target: goal })}
                      >
                        <Plus className="h-3 w-3 mr-1" /> Add
                      </Button>
                    )}
                  </div>
                  {goal.sprints?.items?.length > 0 ? (
                    <div className="space-y-1">
                      {goal.sprints.items.map((item: SprintItem) => (
                        <div 
                          key={item.id} 
                          className="flex items-start gap-2 cursor-pointer hover:bg-accent/20 rounded p-1 -m-1"
                          onClick={() => handleToggleSprint(goal, item.id)}
                        >
                          {item.completed ? (
                            <CheckSquare className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                          )}
                          <span className={`text-xs ${item.completed ? 'line-through text-muted-foreground' : ''}`}>
                            {item.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : goal.sprints?.text ? (
                    <div 
                      className="text-xs cursor-pointer hover:bg-accent/20 rounded p-1 -m-1"
                      onClick={() => convertTextToItems(goal, 'sprint')}
                      title="Click to make checkable"
                    >
                      {goal.sprints.text}
                    </div>
                  ) : null}
                </div>
              )}
              <div className="flex gap-2 pt-2">
                {!isEditing && goal.goal_text && <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => startEditing(quarter, category, goal.goal_number, goal)}>
                    Edit
                  </Button>}
              </div>
            </div>
            <div className="flex flex-col items-end gap-3 min-w-[140px]">
              {goal.by_when && <div className="flex items-center gap-2 text-xs font-medium bg-muted px-3 py-1.5 rounded-md">
                  <Calendar className="h-3 w-3" />
                  <span>{new Date(goal.by_when).toLocaleDateString()}</span>
                </div>}
              <div className="flex gap-1">
                {goal.id && !goal.completed && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      setSelectedTarget(goal);
                      setBreakdownDialogOpen(true);
                    }}
                    title="Get Jericho's help breaking this down"
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                )}
                {goal.id && <Button variant="ghost" size="sm" onClick={() => handleToggleComplete(goal)}>
                    <Check className={`h-4 w-4 ${goal.completed ? "text-green-500" : ""}`} />
                  </Button>}
                {goal.id && <Button variant="ghost" size="sm" onClick={() => handleDeleteGoal(goal)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>;
  };
  const availableYears = getAvailableYears();
  const currentYear = new Date().getFullYear();
  const currentQuarter = getCurrentQuarter();

  return <Card className="bg-highlight-gold">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              90 Day Targets
            </CardTitle>
            <CardDescription>
              Set quarterly goals to track your progress throughout the year
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <ToggleGroup type="single" value={viewMode} onValueChange={(value) => value && setViewMode(value as "stacked" | "columns")}>
              <ToggleGroupItem value="stacked" aria-label="Stacked view">
                <Layers className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="columns" aria-label="Column view">
                <LayoutGrid className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
            <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map(year => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                    {year === currentYear && " (Current)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(selectedYear !== currentYear || selectedQuarter !== currentQuarter) && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setSelectedYear(currentYear);
                  setSelectedQuarter(currentQuarter);
                }}
              >
                Current Quarter
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="max-h-[600px] overflow-y-auto">
        {viewMode === "stacked" ? (
          <Tabs value={selectedQuarter} onValueChange={setSelectedQuarter}>
            <TabsList className="grid w-full grid-cols-4 sticky top-0 z-10 bg-background">
              {QUARTERS.map((q) => (
                <TabsTrigger key={q} value={q}>
                  {q}
                </TabsTrigger>
              ))}
            </TabsList>

            {QUARTERS.map((quarter) => (
              <TabsContent key={quarter} value={quarter} className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-3 text-sm">Personal Targets</h3>
                  <div className="space-y-3">
                    {getTargetsForQuarter(quarter, "personal").map((goal) =>
                      renderGoalCard(goal, quarter, "personal")
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3 text-sm">Professional Targets</h3>
                  <div className="space-y-3">
                    {getTargetsForQuarter(quarter, "professional").map((goal) =>
                      renderGoalCard(goal, quarter, "professional")
                    )}
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {QUARTERS.map((quarter) => (
              <div key={quarter} className="space-y-4">
                <div className="sticky top-0 bg-background pb-2 z-10">
                  <h3 className="text-lg font-bold text-center">{quarter}</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-semibold mb-2">Personal</h4>
                    <div className="space-y-2">
                      {getTargetsForQuarter(quarter, "personal").map((goal) =>
                        renderGoalCard(goal, quarter, "personal")
                      )}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold mb-2">Professional</h4>
                    <div className="space-y-2">
                      {getTargetsForQuarter(quarter, "professional").map((goal) =>
                        renderGoalCard(goal, quarter, "professional")
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      
      <TargetBreakdownDialog
        open={breakdownDialogOpen}
        onOpenChange={setBreakdownDialogOpen}
        target={selectedTarget}
        onSave={loadTargets}
      />

      {/* Add New Item Dialog */}
      <Dialog open={!!addNewItemDialog} onOpenChange={(open) => !open && setAddNewItemDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {addNewItemDialog?.type === 'benchmark' ? '🎯 Add New Benchmark' : '🏃 Add New Sprint'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              {addNewItemDialog?.type === 'benchmark' 
                ? "What's your next 30-day benchmark to hit?"
                : "What will you accomplish in the next 7 days?"}
            </p>
            <Textarea
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              placeholder={addNewItemDialog?.type === 'benchmark' 
                ? "e.g., Complete first draft of project proposal..."
                : "e.g., Research and outline 3 key strategies..."}
              className="min-h-[80px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddNewItemDialog(null)}>
              Skip for now
            </Button>
            <Button onClick={handleAddNewItem} disabled={!newItemText.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              Add {addNewItemDialog?.type === 'benchmark' ? 'Benchmark' : 'Sprint'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>;
}