import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Bot, 
  Zap, 
  Clock, 
  TrendingUp, 
  Plus, 
  Trash2, 
  ArrowRight, 
  ArrowLeft,
  Sparkles,
  CheckCircle,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface JobDescription {
  title: string;
  description: string;
}

const AI_TOOLS = [
  "ChatGPT",
  "Claude",
  "GitHub Copilot",
  "Grammarly",
  "Notion AI",
  "Jasper",
  "Midjourney",
  "DALL-E",
  "Perplexity",
  "Microsoft Copilot",
  "Google Gemini",
  "Zapier AI",
];

export default function AIReadinessLanding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [step, setStep] = useState(1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Step 1: Job Descriptions
  const [jobDescriptions, setJobDescriptions] = useState<JobDescription[]>([
    { title: "", description: "" }
  ]);
  
  // Step 2: Current AI Usage
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [otherTool, setOtherTool] = useState("");
  const [currentWorkflows, setCurrentWorkflows] = useState("");
  
  // Step 3: Lead Capture
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");

  // UTM tracking
  const utmSource = searchParams.get('utm_source') || '';
  const utmMedium = searchParams.get('utm_medium') || '';
  const utmCampaign = searchParams.get('utm_campaign') || '';
  const referralCode = searchParams.get('ref') || '';

  const addJobDescription = () => {
    if (jobDescriptions.length < 5) {
      setJobDescriptions([...jobDescriptions, { title: "", description: "" }]);
    }
  };

  const removeJobDescription = (index: number) => {
    if (jobDescriptions.length > 1) {
      setJobDescriptions(jobDescriptions.filter((_, i) => i !== index));
    }
  };

  const updateJobDescription = (index: number, field: 'title' | 'description', value: string) => {
    const updated = [...jobDescriptions];
    updated[index][field] = value;
    setJobDescriptions(updated);
  };

  const toggleTool = (tool: string) => {
    setSelectedTools(prev => 
      prev.includes(tool) 
        ? prev.filter(t => t !== tool)
        : [...prev, tool]
    );
  };

  const canProceedStep1 = jobDescriptions.some(jd => jd.title.trim() && jd.description.trim());
  const canProceedStep3 = email.trim() && email.includes('@');

  const handleAnalyze = async () => {
    if (!canProceedStep3) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsAnalyzing(true);

    try {
      const allTools = otherTool 
        ? [...selectedTools, otherTool]
        : selectedTools;

      const validJDs = jobDescriptions.filter(jd => jd.title.trim() && jd.description.trim());

      const { data, error } = await supabase.functions.invoke('analyze-public-ai-readiness', {
        body: {
          email,
          name,
          companyName,
          phone,
          jobDescriptions: validJDs,
          currentAITools: allTools,
          currentAIWorkflows: currentWorkflows,
          utmSource,
          utmMedium,
          utmCampaign,
          referralCode,
        },
      });

      if (error) throw error;

      if (data?.shareToken) {
        navigate(`/ai-readiness/report/${data.shareToken}`);
      } else {
        throw new Error("No share token returned");
      }
    } catch (error) {
      console.error("Analysis error:", error);
      toast.error("Failed to analyze. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const progress = (step / 3) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">Jericho AI</span>
          </div>
          <Badge variant="secondary" className="hidden sm:flex">
            <Sparkles className="h-3 w-3 mr-1" />
            Free AI Readiness Analysis
          </Badge>
        </div>
      </header>

      {/* Hero Section */}
      {step === 1 && (
        <section className="container mx-auto px-4 py-12 text-center">
          <Badge variant="outline" className="mb-4">
            <Clock className="h-3 w-3 mr-1" />
            2-minute analysis
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            Is Your Team AI-Ready?
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Discover how many hours per week your team could save with AI. 
            Get personalized recommendations and identify automation opportunities.
          </p>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Analyze up to 5 roles</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Get specific tool recommendations</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Identify AI agent opportunities</span>
            </div>
          </div>
        </section>
      )}

      {/* Progress */}
      <div className="container mx-auto px-4 mb-8">
        <div className="max-w-2xl mx-auto">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between mt-2 text-sm text-muted-foreground">
            <span className={step >= 1 ? "text-primary font-medium" : ""}>1. Job Roles</span>
            <span className={step >= 2 ? "text-primary font-medium" : ""}>2. Current AI Usage</span>
            <span className={step >= 3 ? "text-primary font-medium" : ""}>3. Get Report</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 pb-16">
        <div className="max-w-2xl mx-auto">
          
          {/* Step 1: Job Descriptions */}
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm">1</span>
                  Add Job Roles to Analyze
                </CardTitle>
                <CardDescription>
                  Paste job descriptions or describe the key responsibilities. We'll analyze each role for AI opportunities.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {jobDescriptions.map((jd, index) => (
                  <div key={index} className="space-y-4 p-4 border rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-medium">Role {index + 1}</Label>
                      {jobDescriptions.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeJobDescription(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <Input
                      placeholder="Job Title (e.g., Marketing Manager)"
                      value={jd.title}
                      onChange={(e) => updateJobDescription(index, 'title', e.target.value)}
                    />
                    <Textarea
                      placeholder="Paste the job description or describe key responsibilities..."
                      value={jd.description}
                      onChange={(e) => updateJobDescription(index, 'description', e.target.value)}
                      rows={5}
                    />
                  </div>
                ))}

                {jobDescriptions.length < 5 && (
                  <Button
                    variant="outline"
                    onClick={addJobDescription}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Another Role ({5 - jobDescriptions.length} remaining)
                  </Button>
                )}

                <div className="flex justify-end pt-4">
                  <Button
                    onClick={() => setStep(2)}
                    disabled={!canProceedStep1}
                    size="lg"
                  >
                    Continue
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Current AI Usage */}
          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm">2</span>
                  Current AI Usage (Optional)
                </CardTitle>
                <CardDescription>
                  Tell us what AI tools you're already using so we can focus on additional opportunities.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label>What AI tools is your team using?</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {AI_TOOLS.map((tool) => (
                      <div
                        key={tool}
                        className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedTools.includes(tool)
                            ? 'bg-primary/10 border-primary'
                            : 'hover:bg-muted'
                        }`}
                        onClick={() => toggleTool(tool)}
                      >
                        <Checkbox
                          checked={selectedTools.includes(tool)}
                          onChange={() => {}}
                        />
                        <span className="text-sm">{tool}</span>
                      </div>
                    ))}
                  </div>
                  <Input
                    placeholder="Other tools (comma-separated)"
                    value={otherTool}
                    onChange={(e) => setOtherTool(e.target.value)}
                  />
                </div>

                <div className="space-y-3">
                  <Label>Describe any AI workflows you've implemented</Label>
                  <Textarea
                    placeholder="e.g., We use ChatGPT for drafting emails, Copilot for code review..."
                    value={currentWorkflows}
                    onChange={(e) => setCurrentWorkflows(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  <Button onClick={() => setStep(3)} size="lg">
                    Continue
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Lead Capture */}
          {step === 3 && !isAnalyzing && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm">3</span>
                  Get Your Free Report
                </CardTitle>
                <CardDescription>
                  Enter your email to receive your personalized AI readiness analysis.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        placeholder="Your name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="company">Company</Label>
                      <Input
                        id="company"
                        placeholder="Company name"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="(optional)"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    <span>Instant AI-powered analysis</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span>Personalized recommendations</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Bot className="h-4 w-4 text-primary" />
                    <span>AI agent opportunities identified</span>
                  </div>
                </div>

                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={() => setStep(2)}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    onClick={handleAnalyze}
                    disabled={!canProceedStep3}
                    size="lg"
                    className="bg-gradient-to-r from-primary to-primary/80"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Get My Report
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Analyzing State */}
          {isAnalyzing && (
            <Card className="text-center py-16">
              <CardContent className="space-y-6">
                <div className="relative mx-auto w-24 h-24">
                  <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                  <div className="relative bg-primary rounded-full w-24 h-24 flex items-center justify-center">
                    <Bot className="h-12 w-12 text-primary-foreground animate-pulse" />
                  </div>
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-2">Jericho is Analyzing...</h2>
                  <p className="text-muted-foreground">
                    Our AI is reviewing your job descriptions and identifying automation opportunities.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  This usually takes 15-30 seconds
                </div>
              </CardContent>
            </Card>
          )}
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
