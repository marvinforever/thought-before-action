import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Gauge } from "@/components/ui/gauge";
import { useToast } from "@/hooks/use-toast";
import {
  Clock,
  Calculator,
  Zap,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Wrench,
  TrendingUp,
  DollarSign,
  Copy,
  CheckCircle,
  Play,
  BookOpen,
} from "lucide-react";

interface WorkflowStep {
  step: number;
  action: string;
  tool: string;
  time_minutes: number;
  prompt_template?: string;
}

interface StarterPrompt {
  use_case: string;
  prompt: string;
  expected_output: string;
}

interface AITask {
  task: string;
  instances_per_week?: number;
  minutes_per_instance?: number;
  current_time_hours: number;
  ai_automation_percent?: number;
  estimated_time_after: number;
  hours_saved: number;
  ai_solution: string;
  recommended_tool: string;
  difficulty: "easy" | "medium" | "hard";
  category: "automation" | "augmentation" | "full_automation";
  workflow_steps?: WorkflowStep[];
  starter_prompts?: StarterPrompt[];
  quick_start_guide?: string;
}

interface EmployeeAIData {
  id: string;
  profile_id: string;
  full_name: string;
  email: string;
  role: string;
  ai_readiness_score: number;
  estimated_weekly_hours_saved: number;
  priority_tasks: AITask[];
  recommended_tools: string[];
  generated_at: string;
}

interface EmployeeAIDetailDialogProps {
  employee: EmployeeAIData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartWithJericho?: (task: AITask) => void;
}

const HOURLY_RATE = 75; // $75/hour value

export function EmployeeAIDetailDialog({
  employee,
  open,
  onOpenChange,
  onStartWithJericho,
}: EmployeeAIDetailDialogProps) {
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set());
  const [copiedPrompts, setCopiedPrompts] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  if (!employee) return null;

  const toggleTask = (index: number) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedTasks(newExpanded);
  };

  const copyPrompt = async (prompt: string, id: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedPrompts(prev => new Set(prev).add(id));
      toast({
        title: "Prompt copied!",
        description: "Paste it into ChatGPT, Claude, or Copilot to try it out.",
      });
      setTimeout(() => {
        setCopiedPrompts(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 3000);
    } catch {
      toast({
        title: "Failed to copy",
        description: "Please select and copy the text manually.",
        variant: "destructive",
      });
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "easy":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "hard":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getCategoryIcon = (category: string) => {
    return category === "full_automation" ? (
      <Zap className="h-3 w-3" />
    ) : (
      <TrendingUp className="h-3 w-3" />
    );
  };

  // Calculate totals
  const totalCurrentHours = employee.priority_tasks?.reduce(
    (sum, t) => sum + (t.current_time_hours || 0),
    0
  ) || 0;
  const totalHoursSaved = employee.priority_tasks?.reduce(
    (sum, t) => sum + (t.hours_saved || 0),
    0
  ) || 0;
  const weeklyValue = totalHoursSaved * HOURLY_RATE;
  const annualValue = weeklyValue * 52;

  // Collect all prompts for the prompt library
  const allPrompts = (employee.priority_tasks || []).flatMap((task, taskIdx) => 
    (task.starter_prompts || []).map((sp, spIdx) => ({
      task: task.task,
      tool: task.recommended_tool,
      use_case: sp.use_case,
      prompt: sp.prompt,
      expected_output: sp.expected_output,
      id: `lib-${taskIdx}-${spIdx}`,
      hours_saved: task.hours_saved,
    }))
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
              {employee.full_name?.charAt(0) || "?"}
            </div>
            <div>
              <span>{employee.full_name}</span>
              {employee.role && (
                <Badge variant="secondary" className="ml-2">
                  {employee.role}
                </Badge>
              )}
            </div>
          </DialogTitle>
          <DialogDescription>{employee.email}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)]">
          <div className="space-y-6 pr-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-3 text-center">
                  <Gauge
                    value={Math.round(employee.ai_readiness_score || 0)}
                    max={100}
                    size={80}
                    colorScheme={
                      (employee.ai_readiness_score || 0) >= 70
                        ? "success"
                        : (employee.ai_readiness_score || 0) >= 40
                        ? "warning"
                        : "danger"
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-1">AI Readiness</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-3 text-center">
                  <Clock className="h-5 w-5 mx-auto text-primary mb-1" />
                  <div className="text-2xl font-bold">{totalHoursSaved.toFixed(1)}h</div>
                  <p className="text-xs text-muted-foreground">Hours Saved/Week</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-3 text-center">
                  <DollarSign className="h-5 w-5 mx-auto text-green-600 mb-1" />
                  <div className="text-2xl font-bold text-green-600">
                    ${weeklyValue.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">Weekly Value</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-3 text-center">
                  <TrendingUp className="h-5 w-5 mx-auto text-blue-600 mb-1" />
                  <div className="text-2xl font-bold text-blue-600">
                    ${(annualValue / 1000).toFixed(0)}K
                  </div>
                  <p className="text-xs text-muted-foreground">Annual Value</p>
                </CardContent>
              </Card>
            </div>

            {/* Math Breakdown */}
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Calculator className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">Calculation Breakdown</span>
                  <Badge variant="outline" className="ml-auto text-xs">@${HOURLY_RATE}/hr</Badge>
                </div>
                <div className="text-sm space-y-1 text-muted-foreground">
                  <p>
                    <strong>Current weekly task hours:</strong> {totalCurrentHours.toFixed(1)}h
                  </p>
                  <p>
                    <strong>Projected hours after AI:</strong>{" "}
                    {(totalCurrentHours - totalHoursSaved).toFixed(1)}h
                  </p>
                  <p>
                    <strong>Time saved:</strong> {totalHoursSaved.toFixed(1)}h/week ({totalCurrentHours > 0 ? ((totalHoursSaved / totalCurrentHours) * 100).toFixed(0) : 0}% reduction)
                  </p>
                  <p>
                    <strong>Value calculation:</strong> {totalHoursSaved.toFixed(1)}h × ${HOURLY_RATE}/hr = ${weeklyValue.toLocaleString()}/week → ${annualValue.toLocaleString()}/year
                  </p>
                </div>
              </CardContent>
            </Card>

            <Separator />

            {/* Task Analysis */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                AI Opportunities ({employee.priority_tasks?.length || 0} tasks)
              </h3>

              <div className="space-y-3">
                {(employee.priority_tasks || []).map((task, idx) => (
                  <Card
                    key={idx}
                    className="border-l-4 border-l-primary/50"
                  >
                    <CardContent className="p-4">
                      {/* Task Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-medium text-sm">{task.task}</h4>
                            <Badge
                              variant="outline"
                              className={`text-xs ${getDifficultyColor(task.difficulty)}`}
                            >
                              {task.difficulty}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {task.recommended_tool}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {task.current_time_hours.toFixed(1)}h → {task.estimated_time_after.toFixed(1)}h
                            </span>
                            <span className="text-green-600 font-semibold">
                              Save {task.hours_saved.toFixed(1)}h/week
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* PROMPTS - Always visible */}
                      {task.starter_prompts && task.starter_prompts.length > 0 && (
                        <div className="space-y-2 mb-3">
                          {task.starter_prompts.map((sp, spIdx) => (
                            <div 
                              key={spIdx} 
                              className="bg-primary/5 border border-primary/20 rounded-lg p-3"
                            >
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2">
                                  <Copy className="h-4 w-4 text-primary" />
                                  <span className="font-medium text-sm">{sp.use_case}</span>
                                </div>
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="h-7"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyPrompt(sp.prompt, `prompt-${idx}-${spIdx}`);
                                  }}
                                >
                                  {copiedPrompts.has(`prompt-${idx}-${spIdx}`) ? (
                                    <><CheckCircle className="h-3 w-3 mr-1" /> Copied!</>
                                  ) : (
                                    <><Copy className="h-3 w-3 mr-1" /> Copy Prompt</>
                                  )}
                                </Button>
                              </div>
                              <pre className="text-xs bg-background p-2 rounded border whitespace-pre-wrap font-mono max-h-24 overflow-y-auto">
                                {sp.prompt}
                              </pre>
                              <p className="text-xs text-muted-foreground mt-2">
                                <strong>Result:</strong> {sp.expected_output}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Expand for more details */}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full text-xs text-muted-foreground"
                        onClick={() => toggleTask(idx)}
                      >
                        {expandedTasks.has(idx) ? (
                          <><ChevronUp className="h-3 w-3 mr-1" /> Hide workflow details</>
                        ) : (
                          <><ChevronDown className="h-3 w-3 mr-1" /> Show workflow details</>
                        )}
                      </Button>

                      {expandedTasks.has(idx) && (
                        <div className="mt-4 pt-4 border-t space-y-4">
                          {/* Quick Start Guide */}
                          {task.quick_start_guide && (
                            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3">
                              <div className="flex items-center gap-2 text-green-800 dark:text-green-200 font-medium text-sm mb-1">
                                <Play className="h-4 w-4" />
                                Try This Today
                              </div>
                              <p className="text-sm text-green-700 dark:text-green-300">
                                {task.quick_start_guide}
                              </p>
                            </div>
                          )}

                          {/* How AI Helps */}
                          <div>
                            <h5 className="text-xs font-medium text-muted-foreground mb-1">
                              HOW AI HELPS
                            </h5>
                            <p className="text-sm">{task.ai_solution}</p>
                          </div>

                          <div className="flex items-center gap-2">
                            <Wrench className="h-4 w-4 text-muted-foreground" />
                            <Badge variant="secondary">{task.recommended_tool}</Badge>
                          </div>

                          {/* Workflow Steps */}
                          {task.workflow_steps && task.workflow_steps.length > 0 && (
                            <div>
                              <h5 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                <BookOpen className="h-3 w-3" />
                                STEP-BY-STEP WORKFLOW
                              </h5>
                              <div className="space-y-2">
                                {task.workflow_steps.map((step, stepIdx) => (
                                  <div key={stepIdx} className="flex items-start gap-3 text-sm">
                                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary flex-shrink-0">
                                      {step.step}
                                    </div>
                                    <div className="flex-1">
                                      <p>{step.action}</p>
                                      <div className="flex items-center gap-2 mt-1">
                                        {step.tool && step.tool !== "None" && (
                                          <Badge variant="outline" className="text-xs">{step.tool}</Badge>
                                        )}
                                        <span className="text-xs text-muted-foreground">
                                          ~{step.time_minutes} min
                                        </span>
                                      </div>
                                      {step.prompt_template && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="mt-1 h-7 text-xs"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            copyPrompt(step.prompt_template!, `step-${idx}-${stepIdx}`);
                                          }}
                                        >
                                          {copiedPrompts.has(`step-${idx}-${stepIdx}`) ? (
                                            <><CheckCircle className="h-3 w-3 mr-1" /> Copied!</>
                                          ) : (
                                            <><Copy className="h-3 w-3 mr-1" /> Copy Prompt</>
                                          )}
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Time savings visualization */}
                          <div className="bg-muted/50 p-3 rounded-lg">
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                              <span>Before: {task.current_time_hours.toFixed(1)}h/week</span>
                              <span>After: {task.estimated_time_after.toFixed(1)}h/week</span>
                            </div>
                            <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="absolute inset-y-0 left-0 bg-red-300 dark:bg-red-700"
                                style={{ width: "100%" }}
                              />
                              <div
                                className="absolute inset-y-0 left-0 bg-green-500"
                                style={{
                                  width: `${Math.max(0, Math.min(100, 
                                    ((task.current_time_hours - task.hours_saved) /
                                      task.current_time_hours) *
                                    100
                                  ))}%`,
                                }}
                              />
                            </div>
                            <p className="text-xs text-center mt-1 text-green-600 font-medium">
                              {task.current_time_hours > 0 
                                ? ((task.hours_saved / task.current_time_hours) * 100).toFixed(0)
                                : 0}% time reduction
                            </p>
                          </div>

                          {onStartWithJericho && (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onStartWithJericho(task);
                                onOpenChange(false);
                              }}
                              className="w-full"
                            >
                              <Zap className="mr-2 h-4 w-4" />
                              Practice This With Jericho
                            </Button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Recommended Tools Summary */}
            {employee.recommended_tools && employee.recommended_tools.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Wrench className="h-4 w-4" />
                    Recommended Tools
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {employee.recommended_tools.map((tool, idx) => (
                      <Badge key={idx} variant="outline">
                        {tool}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Generated timestamp */}
            <p className="text-xs text-muted-foreground text-center pt-4">
              Analysis generated{" "}
              {new Date(employee.generated_at).toLocaleDateString()} at{" "}
              {new Date(employee.generated_at).toLocaleTimeString()}
            </p>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
