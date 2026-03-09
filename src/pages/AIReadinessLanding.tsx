import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { trackEvent, getVariant } from "@/lib/posthog";
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
  Users,
  BarChart3,
  Target,
  Lightbulb,
  Shield,
  Upload,
  FileText,
  File,
  X,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface JobDescription {
  title: string;
  description: string;
  fileName?: string;
  isUploading?: boolean;
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

// PROOF - Evidence it works
const STATS = [
  { value: "47%", label: "Average time reclaimed" },
  { value: "12hrs", label: "Weekly hours returned per role" },
  { value: "500+", label: "Roles analyzed across industries" },
];

// PRODUCT - What they get
const BENEFITS = [
  { icon: BarChart3, title: "Role-by-Role Breakdown", desc: "See exactly which tasks are consuming time vs. creating value—for each position" },
  { icon: Lightbulb, title: "Specific Tool Matches", desc: "Get practical recommendations that fit your existing workflows, not generic advice" },
  { icon: Target, title: "Quick Wins First", desc: "Start with low-effort changes that compound—visible progress within days, not months" },
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
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [phone, setPhone] = useState("");

  // UTM tracking
  const utmSource = searchParams.get('utm_source') || '';
  const utmMedium = searchParams.get('utm_medium') || '';
  const utmCampaign = searchParams.get('utm_campaign') || '';
  const referralCode = searchParams.get('ref') || '';

  // Track diagnostic start time for completion_time calculation
  const diagnosticStartRef = useRef<number | null>(null);
  const highestPhaseRef = useRef(1);

  // PostHog: Track landing page view on mount
  useEffect(() => {
    trackEvent('landing_page_viewed', {
      source: utmSource,
      variant: getVariant('landing_headline_variant'),
    });

    // Track abandonment on page leave
    const handleBeforeUnload = () => {
      if (step > 1 && step < 3) {
        trackEvent('diagnostic_abandoned', { last_phase: highestPhaseRef.current });
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleFileUpload = useCallback(async (index: number, file: File) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain'
    ];

    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.pdf') && !file.name.endsWith('.docx') && !file.name.endsWith('.doc') && !file.name.endsWith('.txt')) {
      toast.error("Please upload a PDF, Word document, or text file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    // Update state to show uploading
    const updated = [...jobDescriptions];
    updated[index].isUploading = true;
    updated[index].fileName = file.name;
    setJobDescriptions(updated);

    try {
      // For text files, read directly
      if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        const text = await file.text();
        const updatedAfter = [...jobDescriptions];
        updatedAfter[index].description = text;
        updatedAfter[index].isUploading = false;
        // Try to extract title from filename
        if (!updatedAfter[index].title) {
          updatedAfter[index].title = file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ").replace(/-/g, " ");
        }
        setJobDescriptions(updatedAfter);
        toast.success("File content extracted!");
        return;
      }

      // Upload file to storage
      const filePath = `${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase
        .storage
        .from('job-descriptions')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      // Call edge function to extract text
      const { data, error } = await supabase.functions.invoke('extract-document-text', {
        body: { filePath, fileType: file.type },
      });

      if (error) throw error;

      if (data?.text) {
        const updatedAfter = [...jobDescriptions];
        updatedAfter[index].description = data.text;
        updatedAfter[index].isUploading = false;
        // Try to extract title from filename
        if (!updatedAfter[index].title) {
          updatedAfter[index].title = file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ").replace(/-/g, " ");
        }
        setJobDescriptions(updatedAfter);
        toast.success("Document content extracted!");
      } else {
        throw new Error("No text extracted from document");
      }
    } catch (error) {
      console.error("File upload error:", error);
      const updatedError = [...jobDescriptions];
      updatedError[index].isUploading = false;
      updatedError[index].fileName = undefined;
      setJobDescriptions(updatedError);
      toast.error("Failed to extract text from document. Please paste the content manually.");
    }
  }, [jobDescriptions]);

  const handleDrop = useCallback((index: number, e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(index, file);
    }
  }, [handleFileUpload]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const clearUploadedFile = (index: number) => {
    const updated = [...jobDescriptions];
    updated[index].fileName = undefined;
    updated[index].description = "";
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
  const canProceedStep3 = firstName.trim() && lastName.trim() && email.trim() && email.includes('@') && companyName.trim() && jobTitle.trim() && phone.trim();

  const handleAnalyze = async () => {
    if (!canProceedStep3) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsAnalyzing(true);
    trackEvent('diagnostic_phase_completed', { phase: 3 });

    try {
      const allTools = otherTool 
        ? [...selectedTools, otherTool]
        : selectedTools;

      const validJDs = jobDescriptions.filter(jd => jd.title.trim() && jd.description.trim());

      const { data, error } = await supabase.functions.invoke('analyze-public-ai-readiness', {
        body: {
          email,
          name: `${firstName} ${lastName}`,
          firstName,
          lastName,
          companyName,
          jobTitle,
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-accent rounded-lg p-2">
              <Bot className="h-6 w-6 text-accent-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight">Jericho</span>
          </div>
          <Badge className="bg-accent text-accent-foreground hover:bg-accent/90 hidden sm:flex">
            <Sparkles className="h-3 w-3 mr-1" />
            Free AI Analysis
          </Badge>
        </div>
      </header>

      {/* Hero Section - Only on Step 1 */}
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-primary text-primary-foreground"
          >
            <div className="container mx-auto px-4 py-16 md:py-24">
              <div className="max-w-4xl mx-auto text-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  <Badge variant="outline" className="mb-6 border-accent/50 text-accent bg-accent/10">
                    <Clock className="h-3 w-3 mr-1" />
                    Free • 2 Minutes • Instant Results
                  </Badge>
                </motion.div>

                {/* PERSON - Who this is for */}
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="text-lg md:text-xl text-accent font-medium mb-4"
                >
                  For leaders responsible for team performance, capacity, and growth
                </motion.p>

                {/* PROBLEM - The core pain */}
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-4xl md:text-6xl font-bold mb-6 leading-tight"
                >
                  Your team is <span className="text-accent">stretched thin</span>—<br className="hidden md:block" />
                  but you can't see where the time goes.
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-xl md:text-2xl text-primary-foreground/80 max-w-3xl mx-auto mb-10"
                >
                  Upload or paste 1–5 job descriptions and get a grounded, role-by-role AI Readiness Score.
                  You’ll see where AI can remove low-value work (without disrupting what already works).
                </motion.p>

                {/* PROCESS - How it works */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="max-w-3xl mx-auto mb-10"
                >
                  <p className="text-sm text-primary-foreground/60 uppercase tracking-wider mb-4">How It Works</p>
                  <div className="grid gap-3 md:grid-cols-3 text-left">
                    <div className="rounded-xl border border-primary-foreground/15 bg-primary-foreground/5 p-4">
                      <div className="text-2xl font-bold text-accent mb-1">1</div>
                      <div className="font-semibold">Upload Roles</div>
                      <div className="text-sm text-primary-foreground/70">Drop job descriptions or paste them directly</div>
                    </div>
                    <div className="rounded-xl border border-primary-foreground/15 bg-primary-foreground/5 p-4">
                      <div className="text-2xl font-bold text-accent mb-1">2</div>
                      <div className="font-semibold">Add Context</div>
                      <div className="text-sm text-primary-foreground/70">Tell us what AI tools you already use</div>
                    </div>
                    <div className="rounded-xl border border-primary-foreground/15 bg-primary-foreground/5 p-4">
                      <div className="text-2xl font-bold text-accent mb-1">3</div>
                      <div className="font-semibold">Get Your Map</div>
                      <div className="text-sm text-primary-foreground/70">See the opportunities, prioritized by impact</div>
                    </div>
                  </div>
                </motion.div>

                {/* PROOF - Evidence it works */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="flex flex-wrap justify-center gap-8 md:gap-16 mb-12"
                >
                  {STATS.map((stat, i) => (
                    <div key={i} className="text-center">
                      <div className="text-3xl md:text-4xl font-bold text-accent">{stat.value}</div>
                      <div className="text-sm text-primary-foreground/70">{stat.label}</div>
                    </div>
                  ))}
                </motion.div>

                {/* PRICE + PLACE reinforcement */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="flex flex-wrap justify-center gap-6 text-sm text-primary-foreground/70"
                >
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-accent" />
                    <span>Completely free—no credit card</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-accent" />
                    <span>Analyze up to 5 roles at once</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-accent" />
                    <span>Results delivered instantly online</span>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Wave transition */}
            <div className="relative h-16 md:h-24">
              <svg 
                viewBox="0 0 1440 100" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                className="absolute bottom-0 w-full"
                preserveAspectRatio="none"
              >
                <path 
                  d="M0 100V60C240 20 480 0 720 20C960 40 1200 80 1440 60V100H0Z" 
                  className="fill-background"
                />
              </svg>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Secondary header for steps 2 & 3 */}
      {step > 1 && (
        <div className="bg-primary text-primary-foreground py-8">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-2xl font-bold">AI Readiness Analysis</h2>
            <p className="text-primary-foreground/70">Just a few more steps to get your personalized report</p>
          </div>
        </div>
      )}

      {/* Progress */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-muted rounded-full p-1">
            <Progress value={progress} className="h-2" />
          </div>
          <div className="flex justify-between mt-3 text-sm">
            <span className={`flex items-center gap-1.5 ${step >= 1 ? "text-primary font-semibold" : "text-muted-foreground"}`}>
              {step > 1 ? <CheckCircle className="h-4 w-4 text-green-600" /> : <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">1</span>}
              Job Roles
            </span>
            <span className={`flex items-center gap-1.5 ${step >= 2 ? "text-primary font-semibold" : "text-muted-foreground"}`}>
              {step > 2 ? <CheckCircle className="h-4 w-4 text-green-600" /> : <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/30 text-muted-foreground'}`}>2</span>}
              AI Usage
            </span>
            <span className={`flex items-center gap-1.5 ${step >= 3 ? "text-primary font-semibold" : "text-muted-foreground"}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${step >= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/30 text-muted-foreground'}`}>3</span>
              Get Report
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 pb-16">
        <div className="max-w-2xl mx-auto">
          <AnimatePresence mode="wait">
            {/* Step 1: Job Descriptions */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <Card className="border-2 shadow-lg">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-3 text-xl">
                      <div className="bg-accent text-accent-foreground rounded-full w-10 h-10 flex items-center justify-center font-bold">1</div>
                      Which roles should we analyze?
                    </CardTitle>
                    <CardDescription className="text-base">
                      Upload job descriptions (PDF, Word, or Text) or paste them below. Each role gets its own analysis—start with the ones where capacity matters most.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {jobDescriptions.map((jd, index) => (
                      <motion.div 
                        key={index} 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4 p-5 border-2 rounded-xl bg-muted/30 hover:border-accent/50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <Label className="text-base font-semibold text-primary">Role {index + 1}</Label>
                          {jobDescriptions.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeJobDescription(index)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        
                        <Input
                          placeholder="Job Title (e.g., Marketing Manager)"
                          value={jd.title}
                          onChange={(e) => updateJobDescription(index, 'title', e.target.value)}
                          className="border-2 focus:border-accent"
                        />

                        {/* File Upload Zone */}
                        <div
                          onDrop={(e) => handleDrop(index, e)}
                          onDragOver={handleDragOver}
                          className={`relative border-2 border-dashed rounded-lg p-6 transition-all ${
                            jd.isUploading 
                              ? 'border-accent bg-accent/5' 
                              : jd.fileName 
                                ? 'border-green-500 bg-green-50 dark:bg-green-950/20' 
                                : 'border-muted-foreground/30 hover:border-accent hover:bg-accent/5'
                          }`}
                        >
                          {jd.isUploading ? (
                            <div className="flex flex-col items-center gap-2 text-center">
                              <Loader2 className="h-8 w-8 animate-spin text-accent" />
                              <p className="text-sm text-muted-foreground">Extracting text from {jd.fileName}...</p>
                            </div>
                          ) : jd.fileName && jd.description ? (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-lg">
                                  <FileText className="h-5 w-5 text-green-600" />
                                </div>
                                <div>
                                  <p className="font-medium text-sm">{jd.fileName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {jd.description.length.toLocaleString()} characters extracted
                                  </p>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => clearUploadedFile(index)}
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-3 text-center">
                              <div className="bg-muted rounded-full p-3">
                                <Upload className="h-6 w-6 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">Drop a file here or click to upload</p>
                                <p className="text-xs text-muted-foreground">PDF, Word (.docx), or Text files up to 10MB</p>
                              </div>
                              <input
                                type="file"
                                accept=".pdf,.docx,.doc,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleFileUpload(index, file);
                                }}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              />
                            </div>
                          )}
                        </div>

                        <div className="relative">
                          <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                          </div>
                          <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-muted px-2 text-muted-foreground">Or paste content</span>
                          </div>
                        </div>

                        <Textarea
                          placeholder="Paste the full job description or list the key responsibilities..."
                          value={jd.description}
                          onChange={(e) => updateJobDescription(index, 'description', e.target.value)}
                          rows={5}
                          className="border-2 focus:border-accent resize-none"
                        />
                      </motion.div>
                    ))}

                    {jobDescriptions.length < 5 && (
                      <Button
                        variant="outline"
                        onClick={addJobDescription}
                        className="w-full border-2 border-dashed hover:border-accent hover:bg-accent/5"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Another Role ({5 - jobDescriptions.length} remaining)
                      </Button>
                    )}

                    <div className="flex justify-end pt-4">
                      <Button
                        onClick={() => {
                          if (!diagnosticStartRef.current) diagnosticStartRef.current = Date.now();
                          trackEvent('diagnostic_started', { source: utmSource });
                          trackEvent('diagnostic_phase_completed', { phase: 1 });
                          highestPhaseRef.current = 1;
                          setStep(2);
                        }}
                        disabled={!canProceedStep1}
                        size="lg"
                        className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold px-8"
                      >
                        Continue
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* 9P Framework (Proof • Product • Push) */}
                <section className="mt-12 space-y-6">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-primary">Clarity before urgency</h3>
                    <p className="text-sm text-muted-foreground">
                      Built on the Brand Builders 9 P’s: grounded, specific, and leader-friendly.
                    </p>
                  </div>

                  <div className="grid md:grid-cols-3 gap-6">
                    <div className="text-center p-6 rounded-xl border bg-card">
                      <div className="bg-accent/10 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                        <Users className="h-6 w-6 text-accent" />
                      </div>
                      <h4 className="font-semibold text-primary mb-2">Person</h4>
                      <p className="text-sm text-muted-foreground">You lead a team. You’re responsible for output, quality, and morale.</p>
                    </div>

                    <div className="text-center p-6 rounded-xl border bg-card">
                      <div className="bg-accent/10 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                        <Clock className="h-6 w-6 text-accent" />
                      </div>
                      <h4 className="font-semibold text-primary mb-2">Problem</h4>
                      <p className="text-sm text-muted-foreground">Work is expanding, attention is fragmented, and busy doesn’t equal progress.</p>
                    </div>

                    <div className="text-center p-6 rounded-xl border bg-card">
                      <div className="bg-accent/10 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                        <Target className="h-6 w-6 text-accent" />
                      </div>
                      <h4 className="font-semibold text-primary mb-2">Promise</h4>
                      <p className="text-sm text-muted-foreground">A clear from → to map: where AI can remove drag and increase leverage.</p>
                    </div>

                    <div className="text-center p-6 rounded-xl border bg-card">
                      <div className="bg-accent/10 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                        <BarChart3 className="h-6 w-6 text-accent" />
                      </div>
                      <h4 className="font-semibold text-primary mb-2">Proof</h4>
                      <p className="text-sm text-muted-foreground">Benchmarked patterns from hundreds of roles analyzed (see headline metrics above).</p>
                    </div>

                    <div className="text-center p-6 rounded-xl border bg-card">
                      <div className="bg-accent/10 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                        <Lightbulb className="h-6 w-6 text-accent" />
                      </div>
                      <h4 className="font-semibold text-primary mb-2">Product</h4>
                      <p className="text-sm text-muted-foreground">A role-by-role AI Readiness Report with quick wins and tool recommendations.</p>
                    </div>

                    <div className="text-center p-6 rounded-xl border bg-card">
                      <div className="bg-accent/10 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                        <Shield className="h-6 w-6 text-accent" />
                      </div>
                      <h4 className="font-semibold text-primary mb-2">Price</h4>
                      <p className="text-sm text-muted-foreground">Free to generate your score; register to unlock the full recommendations.</p>
                    </div>

                    <div className="text-center p-6 rounded-xl border bg-card">
                      <div className="bg-accent/10 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                        <Zap className="h-6 w-6 text-accent" />
                      </div>
                      <h4 className="font-semibold text-primary mb-2">Place</h4>
                      <p className="text-sm text-muted-foreground">Delivered online, instantly, with a shareable report link.</p>
                    </div>

                    <div className="text-center p-6 rounded-xl border bg-card md:col-span-2">
                      <div className="bg-accent/10 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                        <ArrowRight className="h-6 w-6 text-accent" />
                      </div>
                      <h4 className="font-semibold text-primary mb-2">Push</h4>
                      <p className="text-sm text-muted-foreground">Start with one role now—clarity compounds fast when you can see the work.</p>
                    </div>
                  </div>
                </section>
              </motion.div>
            )}

            {/* Step 2: Current AI Usage */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <Card className="border-2 shadow-lg">
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary">Optional but helps</Badge>
                    </div>
                    <CardTitle className="flex items-center gap-3 text-xl">
                      <div className="bg-accent text-accent-foreground rounded-full w-10 h-10 flex items-center justify-center font-bold">2</div>
                      What's already in place?
                    </CardTitle>
                    <CardDescription className="text-base">
                      We'll skip what you're already doing and focus on the gaps that matter most.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <Label className="text-base font-semibold">What AI tools is your team using?</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {AI_TOOLS.map((tool) => (
                          <div
                            key={tool}
                            className={`flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                              selectedTools.includes(tool)
                                ? 'bg-accent/10 border-accent shadow-sm'
                                : 'hover:border-muted-foreground/50 hover:bg-muted/50'
                            }`}
                            onClick={() => toggleTool(tool)}
                          >
                            <Checkbox
                              checked={selectedTools.includes(tool)}
                              onChange={() => {}}
                              className="data-[state=checked]:bg-accent data-[state=checked]:border-accent"
                            />
                            <span className="text-sm font-medium">{tool}</span>
                          </div>
                        ))}
                      </div>
                      <Input
                        placeholder="Other tools you're using (comma-separated)"
                        value={otherTool}
                        onChange={(e) => setOtherTool(e.target.value)}
                        className="border-2"
                      />
                    </div>

                    <div className="space-y-4">
                      <Label className="text-base font-semibold">Describe any AI workflows you've implemented</Label>
                      <Textarea
                        placeholder="e.g., We use ChatGPT for drafting emails, Copilot for code review, Jasper for marketing copy..."
                        value={currentWorkflows}
                        onChange={(e) => setCurrentWorkflows(e.target.value)}
                        rows={4}
                        className="border-2 resize-none"
                      />
                    </div>

                    <div className="flex justify-between pt-4">
                      <Button variant="outline" onClick={() => setStep(1)} className="border-2">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                      </Button>
                      <Button 
                        onClick={() => {
                          trackEvent('diagnostic_phase_completed', { phase: 2 });
                          highestPhaseRef.current = 2;
                          setStep(3);
                        }}
                        size="lg"
                        className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold px-8"
                      >
                        Continue
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Step 3: Lead Capture */}
            {step === 3 && !isAnalyzing && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <Card className="border-2 shadow-lg">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-3 text-xl">
                      <div className="bg-accent text-accent-foreground rounded-full w-10 h-10 flex items-center justify-center font-bold">3</div>
                      Where should we send your report?
                    </CardTitle>
                    <CardDescription className="text-base">
                      Your AI Readiness Report will be ready instantly—we just need to know where to deliver it.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="firstName" className="font-medium">First Name <span className="text-destructive">*</span></Label>
                          <Input
                            id="firstName"
                            placeholder="John"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            required
                            className="border-2"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName" className="font-medium">Last Name <span className="text-destructive">*</span></Label>
                          <Input
                            id="lastName"
                            placeholder="Smith"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            required
                            className="border-2"
                          />
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="email" className="font-medium">Work Email <span className="text-destructive">*</span></Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="john@company.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="border-2"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone" className="font-medium">Phone <span className="text-destructive">*</span></Label>
                          <Input
                            id="phone"
                            type="tel"
                            placeholder="(555) 123-4567"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            required
                            className="border-2"
                          />
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="company" className="font-medium">Company Name <span className="text-destructive">*</span></Label>
                          <Input
                            id="company"
                            placeholder="Acme Inc."
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            required
                            className="border-2"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="jobTitle" className="font-medium">Your Job Title <span className="text-destructive">*</span></Label>
                          <Input
                            id="jobTitle"
                            placeholder="Director of Operations"
                            value={jobTitle}
                            onChange={(e) => setJobTitle(e.target.value)}
                            required
                            className="border-2"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-primary/5 border-2 border-primary/20 rounded-xl p-5 space-y-3">
                      <h4 className="font-semibold text-primary">What you'll get:</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 text-sm">
                          <div className="bg-accent rounded-full p-1">
                            <Zap className="h-3 w-3 text-accent-foreground" />
                          </div>
                          <span>AI Readiness Score for each role</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <div className="bg-accent rounded-full p-1">
                            <TrendingUp className="h-3 w-3 text-accent-foreground" />
                          </div>
                          <span>Hours saved per week estimate</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <div className="bg-accent rounded-full p-1">
                            <Lightbulb className="h-3 w-3 text-accent-foreground" />
                          </div>
                          <span>Specific tool recommendations</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <div className="bg-accent rounded-full p-1">
                            <Bot className="h-3 w-3 text-accent-foreground" />
                          </div>
                          <span>AI agent opportunities identified</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between pt-4">
                      <Button variant="outline" onClick={() => setStep(2)} className="border-2">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                      </Button>
                      <Button
                        onClick={handleAnalyze}
                        disabled={!canProceedStep3}
                        size="lg"
                        className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold px-8 shadow-lg hover:shadow-xl transition-all"
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Get My Free Report
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Analyzing State */}
            {isAnalyzing && (
              <motion.div
                key="analyzing"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <Card className="border-2 shadow-lg text-center py-16">
                  <CardContent className="space-y-8">
                    <motion.div 
                      className="relative mx-auto w-32 h-32"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    >
                      <div className="absolute inset-0 bg-accent/20 rounded-full" />
                      <div className="absolute inset-2 bg-accent/30 rounded-full" />
                      <div className="absolute inset-4 bg-accent rounded-full flex items-center justify-center">
                        <Bot className="h-12 w-12 text-accent-foreground" />
                      </div>
                    </motion.div>
                    <div>
                      <h2 className="text-2xl font-bold text-primary mb-3">Jericho is Analyzing...</h2>
                      <p className="text-muted-foreground max-w-md mx-auto">
                        Our AI is reviewing your job descriptions and identifying automation opportunities. This usually takes 30-60 seconds.
                      </p>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <motion.div
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        >
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        </motion.div>
                        <span>Analyzing {jobDescriptions.filter(jd => jd.title && jd.description).length} job role(s)</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Sparkles className="h-4 w-4 text-accent" />
                        <span>Identifying AI opportunities</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-primary text-primary-foreground py-8">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="bg-accent rounded-lg p-1.5">
              <Bot className="h-5 w-5 text-accent-foreground" />
            </div>
            <span className="font-bold">Jericho</span>
          </div>
          <p className="text-sm text-primary-foreground/60">
            Empowering teams to work smarter with AI
          </p>
        </div>
      </footer>
    </div>
  );
}
