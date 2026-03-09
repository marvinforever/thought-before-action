import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { trackEvent } from "@/lib/posthog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Gauge } from "@/components/ui/gauge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Bot, 
  Clock, 
  DollarSign, 
  Zap, 
  Target,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Sparkles,
  ArrowRight,
  Download,
  Share2,
  Loader2,
  AlertCircle,
  Briefcase,
  Lock,
  Eye,
  EyeOff
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AIAugmentableTask {
  taskName: string;
  currentTimeSpent: string;
  aiSolution: string;
  toolsRecommended: string[];
  estimatedTimeSaved: string;
  implementationComplexity: 'low' | 'medium' | 'high';
  agentOpportunity: boolean;
}

interface RoleAnalysis {
  jobTitle: string;
  aiAugmentableTasks: AIAugmentableTask[];
  totalEstimatedWeeklyHoursSaved: number;
  aiReadinessScore: number;
  quickWins: string[];
  agentOpportunities: string[];
  existingAIAcknowledgment?: string;
}

interface ExecutiveSummary {
  rolesAnalyzed: number;
  totalWeeklyHoursSaved: number;
  totalYearlyHoursSaved: number;
  estimatedWeeklyDollarValue: number;
  estimatedYearlyDollarValue: number;
  averageReadinessScore: number;
  topQuickWins: string[];
  topAgentOpportunities: string[];
  totalTasksIdentified: number;
  highImpactTasks: number;
  currentToolsUsed: string[];
  headline: string;
  subheadline: string;
}

interface Assessment {
  id: string;
  email: string;
  name: string;
  company_name: string;
  analysis_results: RoleAnalysis[];
  executive_summary: ExecutiveSummary;
  total_hours_saved: number;
  ai_readiness_score: number;
  status: string;
  created_at: string;
}

export default function AIReadinessReport() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedRoles, setExpandedRoles] = useState<Set<number>>(new Set([0]));
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    loadAssessment();
    checkAuth();
    trackEvent('report_viewed', {});
  }, [shareToken]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setIsUnlocked(true);
    }
  };

  const loadAssessment = async () => {
    if (!shareToken) return;

    try {
      const { data, error } = await supabase
        .from('ai_readiness_assessments')
        .select('*')
        .eq('share_token', shareToken)
        .single();

      if (error) throw error;
      
      // Type assertion for the data
      const assessmentData = data as unknown as Assessment;
      setAssessment(assessmentData);
      
      // Pre-fill register email from assessment
      if (assessmentData.email) {
        setRegisterEmail(assessmentData.email);
      }
    } catch (error) {
      console.error("Error loading assessment:", error);
      toast.error("Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!registerEmail || !registerPassword) {
      toast.error("Please enter email and password");
      return;
    }

    if (registerPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setIsRegistering(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: registerEmail,
        password: registerPassword,
      });

      if (error) throw error;

      if (data.user) {
        setIsUnlocked(true);
        setShowRegisterForm(false);
        toast.success("Account created! You now have full access to the report.");
      }
    } catch (error: any) {
      console.error("Registration error:", error);
      if (error.message?.includes("already registered")) {
        // Try to sign in instead
        try {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: registerEmail,
            password: registerPassword,
          });
          
          if (signInError) throw signInError;
          
          setIsUnlocked(true);
          setShowRegisterForm(false);
          toast.success("Welcome back! You now have full access.");
        } catch (signInError: any) {
          toast.error(signInError.message || "Invalid credentials. Please try again.");
        }
      } else {
        toast.error(error.message || "Failed to create account");
      }
    } finally {
      setIsRegistering(false);
    }
  };

  const toggleRole = (index: number) => {
    setExpandedRoles(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied to clipboard!");
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'high': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading your report...</p>
        </div>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground" />
            <h2 className="text-xl font-bold">Report Not Found</h2>
            <p className="text-muted-foreground">
              This report may have expired or the link is invalid.
            </p>
            <Button asChild>
              <Link to="/ai-readiness">Get Your Own Report</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { executive_summary: summary, analysis_results: analyses } = assessment;

  // Locked content overlay component
  const LockedOverlay = ({ children, title }: { children: React.ReactNode, title: string }) => {
    if (isUnlocked) return <>{children}</>;
    
    return (
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/80 to-background z-10 flex items-end justify-center pb-8">
          <Card className="max-w-md mx-4 shadow-xl border-2 border-primary/20">
            <CardContent className="pt-6 text-center space-y-4">
              <div className="bg-primary/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto">
                <Lock className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Unlock Full Report</h3>
              <p className="text-muted-foreground">
                Create a free account to see all {title.toLowerCase()} and get your complete analysis.
              </p>
              <Button 
                onClick={() => setShowRegisterForm(true)} 
                size="lg" 
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Unlock Full Report
              </Button>
            </CardContent>
          </Card>
        </div>
        <div className="blur-sm pointer-events-none">
          {children}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Registration Modal */}
      {showRegisterForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-accent" />
                Unlock Your Full Report
              </CardTitle>
              <CardDescription>
                Create a free account to access all recommendations, task breakdowns, and AI agent opportunities.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  placeholder="your@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Create Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    placeholder="At least 6 characters"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium">With your free account, you get:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    Detailed task-by-task recommendations
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    AI agent opportunities breakdown
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    Tool recommendations for each task
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    Access to chat with Jericho AI
                  </li>
                </ul>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowRegisterForm(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleRegister}
                  disabled={isRegistering}
                  className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  {isRegistering ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Create Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">Jericho AI</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={copyShareLink}>
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
            {!isUnlocked && (
              <Button size="sm" onClick={() => setShowRegisterForm(true)} className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Lock className="h-4 w-4 mr-2" />
                Unlock Full Report
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <Badge variant="secondary" className="mb-2">
            <Sparkles className="h-3 w-3 mr-1" />
            AI Readiness Report
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold">
            {summary?.headline || `Save ${assessment.total_hours_saved?.toFixed(0) || 0}+ Hours Per Week with AI`}
          </h1>
          <p className="text-xl text-muted-foreground">
            {summary?.subheadline || "Personalized AI automation recommendations for your team"}
          </p>
          {assessment.company_name && (
            <p className="text-sm text-muted-foreground">
              Prepared for {assessment.company_name}
            </p>
          )}
        </div>
      </section>

      {/* Key Metrics - Always visible */}
      <section className="container mx-auto px-4 pb-8">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="text-center border-2 border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-primary">
                {assessment.ai_readiness_score?.toFixed(0) || 0}%
              </div>
              <p className="text-sm text-muted-foreground">AI Readiness Score</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-green-600">
                {assessment.total_hours_saved?.toFixed(0) || 0}
              </div>
              <p className="text-sm text-muted-foreground">Hours Saved/Week</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-blue-600">
                ${((summary?.estimatedYearlyDollarValue || 0) / 1000).toFixed(0)}K
              </div>
              <p className="text-sm text-muted-foreground">Annual Value</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-purple-600">
                {summary?.totalTasksIdentified || 0}
              </div>
              <p className="text-sm text-muted-foreground">Tasks Identified</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Main Content */}
      <main className="container mx-auto px-4 pb-16">
        <div className="max-w-4xl mx-auto">
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="roles">By Role</TabsTrigger>
              <TabsTrigger value="agents">Agent Opportunities</TabsTrigger>
            </TabsList>

            {/* Overview Tab - Partially visible */}
            <TabsContent value="overview" className="space-y-6">
              {/* AI Readiness Gauge - Always visible */}
              <Card>
                <CardHeader>
                  <CardTitle>Your AI Readiness Score</CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center">
                  <Gauge 
                    value={assessment.ai_readiness_score || 0} 
                    max={100}
                    size={200}
                    label="Readiness"
                    colorScheme={
                      (assessment.ai_readiness_score || 0) >= 70 ? 'success' :
                      (assessment.ai_readiness_score || 0) >= 40 ? 'warning' : 'danger'
                    }
                  />
                </CardContent>
              </Card>

              {/* Quick Wins - Locked */}
              <LockedOverlay title="Quick Wins">
                {summary?.topQuickWins && summary.topQuickWins.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-yellow-500" />
                        Quick Wins
                      </CardTitle>
                      <CardDescription>
                        Start with these easy-to-implement improvements
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-3">
                        {summary.topQuickWins.map((win, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                            <span>{win}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </LockedOverlay>

              {/* Current Tools Acknowledgment */}
              {summary?.currentToolsUsed && summary.currentToolsUsed.length > 0 && (
                <Card className="bg-muted/30">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium">You're already using:</p>
                        <p className="text-muted-foreground">
                          {summary.currentToolsUsed.join(', ')}
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                          The recommendations above focus on additional opportunities beyond your current AI usage.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* By Role Tab - Locked */}
            <TabsContent value="roles" className="space-y-4">
              <LockedOverlay title="Role Recommendations">
                {analyses && analyses.map((role, index) => (
                  <Card key={index}>
                    <CardHeader 
                      className="cursor-pointer"
                      onClick={() => toggleRole(index)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Briefcase className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <CardTitle className="text-lg">{role.jobTitle}</CardTitle>
                            <CardDescription>
                              {role.totalEstimatedWeeklyHoursSaved?.toFixed(1) || 0} hours/week • 
                              {role.aiAugmentableTasks?.length || 0} tasks identified
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary">
                            {role.aiReadinessScore?.toFixed(0) || 0}% Ready
                          </Badge>
                          {expandedRoles.has(index) ? (
                            <ChevronUp className="h-5 w-5" />
                          ) : (
                            <ChevronDown className="h-5 w-5" />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    
                    {expandedRoles.has(index) && (
                      <CardContent className="space-y-4">
                        {role.existingAIAcknowledgment && (
                          <div className="bg-primary/5 rounded-lg p-3 text-sm">
                            {role.existingAIAcknowledgment}
                          </div>
                        )}

                        {role.aiAugmentableTasks?.map((task, taskIndex) => (
                          <div 
                            key={taskIndex}
                            className="border rounded-lg p-4 space-y-3"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-medium">{task.taskName}</h4>
                                  {task.agentOpportunity && (
                                    <Badge variant="default" className="bg-purple-600">
                                      <Bot className="h-3 w-3 mr-1" />
                                      Agent Opportunity
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {task.aiSolution}
                                </p>
                              </div>
                              <Badge className={getComplexityColor(task.implementationComplexity)}>
                                {task.implementationComplexity}
                              </Badge>
                            </div>
                            
                            <div className="flex flex-wrap gap-4 text-sm">
                              <div className="flex items-center gap-1">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span>Current: {task.currentTimeSpent}</span>
                              </div>
                              <div className="flex items-center gap-1 text-green-600">
                                <Target className="h-4 w-4" />
                                <span>Save: {task.estimatedTimeSaved}</span>
                              </div>
                            </div>

                            {task.toolsRecommended && task.toolsRecommended.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {task.toolsRecommended.map((tool, i) => (
                                  <Badge key={i} variant="outline">{tool}</Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}

                        {role.quickWins && role.quickWins.length > 0 && (
                          <div className="bg-muted/30 rounded-lg p-4">
                            <h5 className="font-medium mb-2 flex items-center gap-2">
                              <Zap className="h-4 w-4 text-yellow-500" />
                              Quick Wins for this Role
                            </h5>
                            <ul className="space-y-1 text-sm">
                              {role.quickWins.map((win, i) => (
                                <li key={i} className="flex items-center gap-2">
                                  <CheckCircle className="h-3 w-3 text-green-500" />
                                  {win}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                ))}
              </LockedOverlay>
            </TabsContent>

            {/* Agent Opportunities Tab - Locked */}
            <TabsContent value="agents" className="space-y-6">
              <LockedOverlay title="Agent Opportunities">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bot className="h-5 w-5 text-purple-600" />
                      AI Agent Opportunities
                    </CardTitle>
                    <CardDescription>
                      These tasks could be fully automated with custom AI agents—not just assisted, but handled entirely by AI.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {summary?.topAgentOpportunities && summary.topAgentOpportunities.length > 0 ? (
                      <ul className="space-y-4">
                        {summary.topAgentOpportunities.map((opp, i) => (
                          <li key={i} className="flex items-start gap-3 p-4 border rounded-lg">
                            <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg">
                              <Bot className="h-5 w-5 text-purple-600" />
                            </div>
                            <div>
                              <p className="font-medium">{opp}</p>
                              <p className="text-sm text-muted-foreground mt-1">
                                Could be fully automated with a custom AI agent
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground text-center py-8">
                        No fully-automatable agent opportunities identified. 
                        The tasks found are better suited for AI assistance rather than full automation.
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-primary/10 to-purple-500/10 border-primary/20">
                  <CardContent className="pt-6">
                    <div className="text-center space-y-4">
                      <Bot className="h-12 w-12 mx-auto text-primary" />
                      <h3 className="text-xl font-bold">Ready to Build Your AI Agents?</h3>
                      <p className="text-muted-foreground max-w-md mx-auto">
                        Jericho can help you design and implement custom AI agents for these opportunities. 
                        Talk to Jericho to get started.
                      </p>
                      <Button size="lg" className="bg-gradient-to-r from-primary to-purple-600">
                        <Sparkles className="h-4 w-4 mr-2" />
                        Talk to Jericho
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </LockedOverlay>
            </TabsContent>
          </Tabs>

          {/* CTA Section */}
          <Card className="mt-8 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
            <CardContent className="py-8">
              <div className="text-center space-y-4">
                <h2 className="text-2xl font-bold">
                  {isUnlocked ? "Want a Complete Team Analysis?" : "Unlock Your Full Report"}
                </h2>
                <p className="opacity-90 max-w-lg mx-auto">
                  {isUnlocked 
                    ? "Get deeper insights, track implementation progress, and build custom AI agents with a full Jericho account."
                    : "Create a free account to see all recommendations, task breakdowns, and AI agent opportunities."}
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                  {isUnlocked ? (
                    <>
                      <Button size="lg" variant="secondary">
                        Book a Demo
                      </Button>
                      <Button size="lg" variant="outline" className="bg-transparent border-primary-foreground/30 hover:bg-primary-foreground/10">
                        Start Free Trial
                      </Button>
                    </>
                  ) : (
                    <Button 
                      size="lg" 
                      variant="secondary"
                      onClick={() => setShowRegisterForm(true)}
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      Unlock Full Report - Free
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/30 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2024 Jericho AI. Your data is secure and never shared.</p>
        </div>
      </footer>
    </div>
  );
}
