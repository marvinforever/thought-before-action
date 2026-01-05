import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { 
  User, 
  Briefcase, 
  Target, 
  Sparkles, 
  ArrowRight, 
  ArrowLeft,
  Loader2,
  Play,
  CheckCircle2
} from "lucide-react";

type WizardStep = "welcome" | "profile" | "role" | "goals" | "attribution" | "generating" | "complete";

const TOTAL_STEPS = 5;

const stepConfig: Record<string, { number: number; title: string }> = {
  welcome: { number: 0, title: "Welcome" },
  profile: { number: 1, title: "About You" },
  role: { number: 2, title: "Your Role" },
  goals: { number: 3, title: "Your Goals" },
  attribution: { number: 4, title: "One More Thing" },
  generating: { number: 5, title: "Creating Your Brief" },
  complete: { number: 5, title: "All Set!" },
};

const attributionOptions = [
  { value: "colleague", label: "Colleague or friend" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "google", label: "Google search" },
  { value: "partner", label: "Partner referral" },
  { value: "event", label: "Conference or event" },
  { value: "other", label: "Other" },
];

const goalOptions = [
  { value: "leadership", label: "Develop leadership skills" },
  { value: "clarity", label: "Get clarity on my career path" },
  { value: "productivity", label: "Be more productive" },
  { value: "communication", label: "Improve communication" },
  { value: "team", label: "Build a stronger team" },
  { value: "balance", label: "Better work-life balance" },
];

export function RegistrationWizard() {
  const [step, setStep] = useState<WizardStep>("welcome");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  // Form data
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [primaryGoal, setPrimaryGoal] = useState("");
  const [goalDetails, setGoalDetails] = useState("");
  const [attribution, setAttribution] = useState("");
  
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkRegistrationStatus();
  }, []);

  const checkRegistrationStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      setUserId(user.id);

      // Check if profile exists and is complete
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, registration_complete, created_by_admin")
        .eq("id", user.id)
        .maybeSingle();

      // If created by admin, skip wizard
      if (profile?.created_by_admin) {
        navigate("/dashboard/my-growth-plan");
        return;
      }

      // If registration already complete, go to dashboard
      if (profile?.registration_complete) {
        navigate("/dashboard/my-growth-plan");
        return;
      }

      // Pre-fill name if we have it
      if (profile?.full_name) {
        setFullName(profile.full_name);
      } else if (user.user_metadata?.full_name) {
        setFullName(user.user_metadata.full_name);
      }

      setLoading(false);
    } catch (error) {
      console.error("Error checking registration status:", error);
      setLoading(false);
    }
  };

  const nextStep = () => {
    const steps: WizardStep[] = ["welcome", "profile", "role", "goals", "attribution"];
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    } else {
      // Final step - generate podcast
      generateWelcomePodcast();
    }
  };

  const prevStep = () => {
    const steps: WizardStep[] = ["welcome", "profile", "role", "goals", "attribution"];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  };

  const saveProfileData = async () => {
    if (!userId) return;

    try {
      // Create or update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: userId,
          full_name: fullName,
          job_title: jobTitle,
          company_id: "00000000-0000-0000-0000-000000000001", // Default company for self-serve
        }, { onConflict: "id" });

      if (profileError) throw profileError;

      // Save registration metadata
      const { error: metaError } = await supabase
        .from("registration_metadata")
        .upsert({
          profile_id: userId,
          company_name: companyName,
          primary_goal: primaryGoal,
          goal_details: goalDetails,
          attribution_source: attribution,
        }, { onConflict: "profile_id" });

      if (metaError) {
        console.error("Error saving registration metadata:", metaError);
        // Non-fatal - continue anyway
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      throw error;
    }
  };

  const generateWelcomePodcast = async () => {
    setStep("generating");
    setGenerating(true);

    try {
      // Save profile data first
      await saveProfileData();

      // Generate podcast script
      const scriptResponse = await supabase.functions.invoke("generate-podcast-script", {
        body: { 
          profileId: userId,
          isWelcome: true,
          userName: fullName.split(" ")[0],
          primaryGoal,
          goalDetails,
        },
      });

      if (scriptResponse.error) throw scriptResponse.error;

      const script = scriptResponse.data?.script;
      if (!script) throw new Error("No script generated");

      // Generate audio
      const audioResponse = await supabase.functions.invoke("elevenlabs-tts", {
        body: {
          script,
          profileId: userId,
          episodeDate: new Date().toISOString().split("T")[0],
          storeAudio: true,
        },
      });

      if (audioResponse.error) throw audioResponse.error;

      const generatedAudioUrl = audioResponse.data?.audioUrl;
      setAudioUrl(generatedAudioUrl);

      // Save podcast episode
      await supabase.from("podcast_episodes").upsert({
        profile_id: userId,
        company_id: "00000000-0000-0000-0000-000000000001", // Default company
        episode_date: new Date().toISOString().split("T")[0],
        title: "Welcome to Jericho",
        script,
        audio_url: generatedAudioUrl,
        duration_seconds: 180,
        topics_covered: ["welcome", primaryGoal],
        is_welcome_episode: true,
      } as any, { onConflict: "profile_id,episode_date" });

      // Mark registration as complete
      await supabase
        .from("profiles")
        .update({ registration_complete: true })
        .eq("id", userId);

      setStep("complete");
    } catch (error: any) {
      console.error("Error generating podcast:", error);
      toast({
        title: "Couldn't generate your podcast",
        description: "We'll try again later. Let's get you into Jericho!",
        variant: "destructive",
      });
      
      // Still mark as complete so they can use the app
      await supabase
        .from("profiles")
        .update({ registration_complete: true })
        .eq("id", userId);
      
      navigate("/dashboard/my-growth-plan");
    } finally {
      setGenerating(false);
    }
  };

  const handleComplete = () => {
    navigate("/dashboard/my-growth-plan");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const progress = (stepConfig[step].number / TOTAL_STEPS) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        {step !== "welcome" && step !== "generating" && step !== "complete" && (
          <div className="mb-6">
            <div className="flex justify-between text-sm text-muted-foreground mb-2">
              <span>Step {stepConfig[step].number} of {TOTAL_STEPS - 1}</span>
              <span>{stepConfig[step].title}</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {/* Welcome Step */}
            {step === "welcome" && (
              <Card className="border-2 border-primary/20">
                <CardHeader className="text-center pb-2">
                  <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                    <Sparkles className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle className="text-2xl">Welcome to Jericho</CardTitle>
                  <CardDescription className="text-base">
                    Your AI-powered career coach. Let's get you set up in about 2 minutes.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <User className="h-5 w-5 text-primary" />
                      <span>Tell us a bit about yourself</span>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <Target className="h-5 w-5 text-primary" />
                      <span>Share what you want to accomplish</span>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <Play className="h-5 w-5 text-primary" />
                      <span>Get your personalized welcome brief</span>
                    </div>
                  </div>
                  <Button onClick={nextStep} className="w-full" size="lg">
                    Let's Go
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Profile Step */}
            {step === "profile" && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>About You</CardTitle>
                      <CardDescription>What should we call you?</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Your Name</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Jane Smith"
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button variant="outline" onClick={prevStep} className="flex-1">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button 
                      onClick={nextStep} 
                      className="flex-1"
                      disabled={!fullName.trim()}
                    >
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Role Step */}
            {step === "role" && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <Briefcase className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Your Role</CardTitle>
                      <CardDescription>Help us personalize your experience</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="jobTitle">Job Title</Label>
                    <Input
                      id="jobTitle"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      placeholder="e.g., Sales Manager, Software Engineer"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Your company or organization"
                    />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button variant="outline" onClick={prevStep} className="flex-1">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button onClick={nextStep} className="flex-1">
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Goals Step */}
            {step === "goals" && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <Target className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Your Goals</CardTitle>
                      <CardDescription>What do you want to focus on?</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <RadioGroup value={primaryGoal} onValueChange={setPrimaryGoal}>
                    <div className="grid gap-2">
                      {goalOptions.map((option) => (
                        <div
                          key={option.value}
                          className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            primaryGoal === option.value
                              ? "border-primary bg-primary/5"
                              : "border-border hover:bg-muted/50"
                          }`}
                          onClick={() => setPrimaryGoal(option.value)}
                        >
                          <RadioGroupItem value={option.value} id={option.value} />
                          <Label htmlFor={option.value} className="cursor-pointer flex-1">
                            {option.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>
                  <div className="space-y-2">
                    <Label htmlFor="goalDetails">Tell us more (optional)</Label>
                    <Textarea
                      id="goalDetails"
                      value={goalDetails}
                      onChange={(e) => setGoalDetails(e.target.value)}
                      placeholder="What specific challenges are you facing? What does success look like?"
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button variant="outline" onClick={prevStep} className="flex-1">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button 
                      onClick={nextStep} 
                      className="flex-1"
                      disabled={!primaryGoal}
                    >
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Attribution Step */}
            {step === "attribution" && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>One More Thing</CardTitle>
                      <CardDescription>How did you hear about Jericho?</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <RadioGroup value={attribution} onValueChange={setAttribution}>
                    <div className="grid gap-2">
                      {attributionOptions.map((option) => (
                        <div
                          key={option.value}
                          className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            attribution === option.value
                              ? "border-primary bg-primary/5"
                              : "border-border hover:bg-muted/50"
                          }`}
                          onClick={() => setAttribution(option.value)}
                        >
                          <RadioGroupItem value={option.value} id={`attr-${option.value}`} />
                          <Label htmlFor={`attr-${option.value}`} className="cursor-pointer flex-1">
                            {option.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>
                  <div className="flex gap-3 pt-4">
                    <Button variant="outline" onClick={prevStep} className="flex-1">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button 
                      onClick={nextStep} 
                      className="flex-1"
                      disabled={!attribution}
                    >
                      Create My Brief
                      <Sparkles className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Generating Step */}
            {step === "generating" && (
              <Card className="border-2 border-primary/20">
                <CardContent className="py-12 text-center">
                  <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                    <Loader2 className="h-10 w-10 text-primary animate-spin" />
                  </div>
                  <h2 className="text-xl font-semibold mb-2">Creating Your Welcome Brief</h2>
                  <p className="text-muted-foreground">
                    Jericho is preparing a personalized podcast just for you...
                  </p>
                  <div className="mt-6 space-y-2 text-sm text-muted-foreground">
                    <p>✨ Analyzing your goals</p>
                    <p>🎯 Tailoring your coaching approach</p>
                    <p>🎙️ Recording your episode</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Complete Step */}
            {step === "complete" && (
              <Card className="border-2 border-primary/20">
                <CardContent className="py-12 text-center">
                  <div className="mx-auto w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle2 className="h-10 w-10 text-green-500" />
                  </div>
                  <h2 className="text-xl font-semibold mb-2">You're All Set!</h2>
                  <p className="text-muted-foreground mb-6">
                    Your personalized welcome brief is ready. Let's start your growth journey!
                  </p>
                  
                  {audioUrl && (
                    <div className="mb-6">
                      <audio controls className="w-full" src={audioUrl}>
                        Your browser does not support the audio element.
                      </audio>
                    </div>
                  )}
                  
                  <Button onClick={handleComplete} size="lg" className="w-full">
                    Enter Jericho
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}