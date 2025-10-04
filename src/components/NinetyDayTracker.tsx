import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Target, Plus, Check, Trash2, Sparkles, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const years = [];
  for (let year = currentYear; year >= startYear; year--) {
    years.push(year);
  }
  return years;
};

export default function NinetyDayTracker() {
  const [targets, setTargets] = useState<NinetyDayTarget[]>([]);
  const [selectedQuarter, setSelectedQuarter] = useState(getCurrentQuarter());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [editingGoal, setEditingGoal] = useState<{
    quarter: string;
    category: string;
    number: number;
  } | null>(null);
  const [formData, setFormData] = useState({
    goalText: "",
    byWhen: "",
    supportNeeded: ""
  });
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const {
    toast
  } = useToast();
  useEffect(() => {
    loadTargets();
  }, [selectedYear]);
  const loadTargets = async () => {
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) return;
      const {
        data,
        error
      } = await supabase.from("ninety_day_targets").select("*").eq("profile_id", user.id).eq("year", selectedYear).order("goal_number", {
        ascending: true
      });
      if (error) throw error;
      setTargets(data || []);
    } catch (error: any) {
      console.error("Error loading targets:", error);
    }
  };
  const getTargetsForQuarter = (quarter: string, category: string) => {
    return [1, 2, 3].map(num => {
      const existing = targets.find(t => t.quarter === quarter && t.category === category && t.goal_number === num);
      return existing || {
        quarter,
        category,
        goal_number: num,
        goal_text: null,
        by_when: null,
        support_needed: null,
        completed: false
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
      const {
        data: profile
      } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
      if (!profile) throw new Error("Profile not found");
      const payload = {
        profile_id: user.id,
        company_id: profile.company_id,
        quarter,
        year: selectedYear,
        category,
        goal_number: goalNumber,
        goal_text: formData.goalText || null,
        by_when: formData.byWhen || null,
        support_needed: formData.supportNeeded || null
      };
      const {
        error
      } = await supabase.from("ninety_day_targets").upsert(payload, {
        onConflict: 'profile_id,quarter,year,category,goal_number'
      });
      if (error) throw error;
      toast({
        title: "Goal saved",
        description: "Your 90-day target has been updated"
      });
      setEditingGoal(null);
      setFormData({
        goalText: "",
        byWhen: "",
        supportNeeded: ""
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
        error
      } = await supabase.from("ninety_day_targets").update({
        completed: !target.completed
      }).eq("id", target.id);
      if (error) throw error;
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
  const startEditing = (quarter: string, category: string, goalNumber: number, existing?: any) => {
    setEditingGoal({
      quarter,
      category,
      number: goalNumber
    });
    if (existing && existing.goal_text) {
      setFormData({
        goalText: existing.goal_text || "",
        byWhen: existing.by_when || "",
        supportNeeded: existing.support_needed || ""
      });
    } else {
      setFormData({
        goalText: "",
        byWhen: "",
        supportNeeded: ""
      });
    }
    setAiSuggestion("");
  };

  const handleGetAiHelp = async () => {
    if (!editingGoal) return;
    
    setIsLoadingAi(true);
    setAiSuggestion("");

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/help-write-goal`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            draftGoal: formData.goalText,
            category: editingGoal.category,
            quarter: editingGoal.quarter,
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
              setAiSuggestion(prev => prev + content);
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
              setAiSuggestion(prev => prev + content);
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
      setIsLoadingAi(false);
    }
  };

  const handleUseAiSuggestion = () => {
    setFormData(prev => ({
      ...prev,
      goalText: aiSuggestion,
    }));
    setAiSuggestion("");
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
                  onClick={handleGetAiHelp}
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
        <CardContent className="pt-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-muted-foreground">Goal {goal.goal_number}</span>
                {goal.completed && <Badge variant="secondary" className="text-xs">Complete</Badge>}
              </div>
              <p className={`text-sm ${goal.completed ? "line-through text-muted-foreground" : ""}`}>
                {goal.goal_text}
              </p>
            </div>
            <div className="flex gap-1">
              {goal.id && <Button variant="ghost" size="sm" onClick={() => handleToggleComplete(goal)}>
                  <Check className={`h-4 w-4 ${goal.completed ? "text-green-500" : ""}`} />
                </Button>}
              {goal.id && <Button variant="ghost" size="sm" onClick={() => handleDeleteGoal(goal)}>
                  <Trash2 className="h-4 w-4" />
                </Button>}
            </div>
          </div>
          {goal.by_when && <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>By {new Date(goal.by_when).toLocaleDateString()}</span>
            </div>}
          {goal.support_needed && <p className="text-xs text-muted-foreground italic">
              Support: {goal.support_needed}
            </p>}
          {!isEditing && goal.goal_text && <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={() => startEditing(quarter, category, goal.goal_number, goal)}>
              Edit
            </Button>}
        </CardContent>
      </Card>;
  };
  const availableYears = getAvailableYears();
  const currentYear = new Date().getFullYear();
  const currentQuarter = getCurrentQuarter();

  return <Card>
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
          <div className="flex items-center gap-2">
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
      <CardContent>
        <Tabs value={selectedQuarter} onValueChange={setSelectedQuarter}>
          <TabsList className="grid w-full grid-cols-4">
            {QUARTERS.map(q => <TabsTrigger key={q} value={q}>
                {q}
              </TabsTrigger>)}
          </TabsList>

          {QUARTERS.map(quarter => <TabsContent key={quarter} value={quarter} className="space-y-6">
              <div>
                <h3 className="font-semibold mb-3 text-sm">Personal Targets</h3>
                <div className="grid gap-3 md:grid-cols-3">
                  {getTargetsForQuarter(quarter, "personal").map(goal => renderGoalCard(goal, quarter, "personal"))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3 text-sm">Professional Targets</h3>
                <div className="grid gap-3 md:grid-cols-3">
                  {getTargetsForQuarter(quarter, "professional").map(goal => renderGoalCard(goal, quarter, "professional"))}
                </div>
              </div>
            </TabsContent>)}
        </Tabs>
      </CardContent>
    </Card>;
}