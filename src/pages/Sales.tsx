import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { 
  ArrowRight, 
  ArrowDown,
  Target, 
  TrendingUp, 
  Users, 
  CheckCircle2, 
  Zap,
  Calendar,
  BarChart3,
  Brain,
  MessageSquare,
  Sparkles,
  Shield,
  ChevronDown,
  MoveDown,
  Headphones,
  Mic,
  Flame,
  Route,
  FileText
} from "lucide-react";

// Client logos
import loganLogo from "@/assets/logos/logan-contractors.avif";
import mcmLogo from "@/assets/logos/mcm-logo.png";
import iasLogo from "@/assets/logos/ias-logo.png";
import slcLogo from "@/assets/logos/slc-logo.png";
import winfieldLogo from "@/assets/logos/winfield-logo.png";
import agPartnersLogo from "@/assets/logos/ag-partners-logo.webp";

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

// Animated arrow component for section transitions
const FlowArrow = ({ className = "" }: { className?: string }) => (
  <div className={`flex justify-center py-4 ${className}`}>
    <motion.div
      animate={{ y: [0, 8, 0] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      className="flex flex-col items-center gap-1"
    >
      <ChevronDown className="h-6 w-6 text-accent" />
      <ChevronDown className="h-6 w-6 text-accent/60 -mt-4" />
    </motion.div>
  </div>
);

// Side flowing arrows for visual movement
const SideFlowArrows = ({ direction = "right", className = "" }: { direction?: "left" | "right", className?: string }) => (
  <div className={`absolute top-1/2 -translate-y-1/2 ${direction === "right" ? "right-4 md:right-8" : "left-4 md:left-8"} hidden lg:flex flex-col gap-2 ${className}`}>
    {[0, 1, 2].map((i) => (
      <motion.div
        key={i}
        animate={{ 
          x: direction === "right" ? [0, 10, 0] : [0, -10, 0],
          opacity: [0.3, 0.7, 0.3]
        }}
        transition={{ 
          duration: 2, 
          repeat: Infinity, 
          delay: i * 0.3,
          ease: "easeInOut"
        }}
      >
        <ArrowRight className={`h-5 w-5 text-accent/40 ${direction === "left" ? "rotate-180" : ""}`} />
      </motion.div>
    ))}
  </div>
);

const Sales = () => {
  const [email, setEmail] = useState("");
  const [searchParams] = useSearchParams();

  // Track referral click on page load
  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      localStorage.setItem('referral_code', refCode);
      localStorage.setItem('referral_timestamp', Date.now().toString());
      
      // Track the click in the database
      const trackClick = async () => {
        try {
          const { data: partnerId } = await supabase
            .rpc('get_partner_id_by_referral_code', { p_referral_code: refCode });
          
          if (partnerId) {
            await supabase.from('referral_leads').insert({
              partner_id: partnerId,
              status: 'clicked',
            });
          }
        } catch (error) {
          console.log('Click tracking error:', error);
        }
      };
      
      // Only track once per session to avoid duplicate clicks
      const sessionKey = `referral_click_${refCode}`;
      if (!sessionStorage.getItem(sessionKey)) {
        sessionStorage.setItem(sessionKey, 'true');
        trackClick();
      }
    }
  }, [searchParams]);

  // Demo form state
  const [showDemoForm, setShowDemoForm] = useState(false);
  const [demoName, setDemoName] = useState('');
  const [demoCompany, setDemoCompany] = useState('');
  const [demoEmail, setDemoEmail] = useState('');
  const [isSubmittingDemo, setIsSubmittingDemo] = useState(false);

  const handleDemoRequest = () => {
    // Always show the form to capture contact info for marketing
    setShowDemoForm(true);
  };

  const handleDemoFormSubmit = async () => {
    if (!demoName.trim() || !demoEmail.trim()) return;
    
    setIsSubmittingDemo(true);
    const refCode = searchParams.get('ref') || localStorage.getItem('referral_code');

    // Open calendar immediately
    window.open('https://calendar.app.google/v1xwnCaqnRJ57UmJ6', '_blank');
    setShowDemoForm(false);

    // Capture UTM params if present
    const utmSource = searchParams.get('utm_source');
    const utmMedium = searchParams.get('utm_medium');
    const utmCampaign = searchParams.get('utm_campaign');

    // Always save to demo_requests for marketing capture
    try {
      await supabase.from('demo_requests').insert({
        name: demoName.trim(),
        email: demoEmail.trim(),
        company: demoCompany.trim() || null,
        referral_code: refCode || null,
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
      });
    } catch (error) {
      console.log('Demo request capture error:', error);
    }

    // Also track in referral_leads if there's a referral code
    if (refCode) {
      try {
        const { data: partnerId } = await supabase
          .rpc('get_partner_id_by_referral_code', { p_referral_code: refCode });

        if (partnerId) {
          await supabase.from('referral_leads').insert({
            partner_id: partnerId,
            lead_company: demoCompany.trim(),
            contact_name: demoName.trim(),
            lead_email: demoEmail.trim(),
            status: 'demo_booked',
          });
        }
      } catch (error) {
        console.log('Referral demo tracking error:', error);
      }
    }

    // Reset form
    setDemoName('');
    setDemoCompany('');
    setDemoEmail('');
    setIsSubmittingDemo(false);
  };

  const handleTrialRequest = () => {
    window.location.href = `/auth?email=${encodeURIComponent(email)}&trial=true`;
  };

  return (
    <>
      {/* Demo Form Dialog */}
      <Dialog open={showDemoForm} onOpenChange={setShowDemoForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Book Your Demo</DialogTitle>
            <DialogDescription>
              Quick info so we can personalize your demo experience.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="demo-name">Your Name</Label>
              <Input
                id="demo-name"
                placeholder="John Smith"
                value={demoName}
                onChange={(e) => setDemoName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="demo-company">Company Name</Label>
              <Input
                id="demo-company"
                placeholder="Acme Corp"
                value={demoCompany}
                onChange={(e) => setDemoCompany(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="demo-email">Work Email</Label>
              <Input
                id="demo-email"
                type="email"
                placeholder="john@acme.com"
                value={demoEmail}
                onChange={(e) => setDemoEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowDemoForm(false)} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handleDemoFormSubmit} 
              disabled={!demoName.trim() || !demoCompany.trim() || !demoEmail.trim() || isSubmittingDemo}
              className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {isSubmittingDemo ? 'Opening...' : 'Continue to Calendar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-primary/95 backdrop-blur-md border-b border-primary">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center shadow-lg shadow-accent/30">
              <Sparkles className="w-6 h-6 text-accent-foreground" />
            </div>
            <div>
              <span className="text-xl font-bold text-primary-foreground">Jericho</span>
              <span className="hidden sm:block text-[10px] text-primary-foreground/70 -mt-1">by The Momentum Company</span>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/auth">
              <Button variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10">Sign In</Button>
            </Link>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg shadow-accent/30" onClick={handleDemoRequest}>
              Book a Demo
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero - Navy background with gold accents */}
      <section className="pt-28 pb-16 px-6 bg-primary relative overflow-hidden">
        <div className="absolute top-20 -right-32 w-[500px] h-[500px] bg-accent/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 -left-32 w-[400px] h-[400px] bg-accent/10 rounded-full blur-[100px]" />
        
        <div className="max-w-5xl mx-auto text-center relative">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="space-y-6"
          >
            <motion.div variants={fadeIn} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/20 border border-accent/30">
              <Zap className="w-4 h-4 text-accent" />
              <span className="text-accent font-medium text-sm">The System That Shows Up Daily</span>
            </motion.div>
            
            <motion.div variants={fadeIn} className="space-y-4">
              <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold leading-tight text-primary-foreground/80 italic">
                "You don't rise to your goals.<br />
                You fall to your systems."
              </h1>
              <motion.p 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.6 }}
                className="text-4xl md:text-6xl lg:text-7xl font-bold text-accent"
              >
                Welcome to Jericho.
              </motion.p>
            </motion.div>
            
            <motion.p 
              variants={fadeIn}
              className="text-xl md:text-2xl text-primary-foreground/80 max-w-3xl mx-auto leading-relaxed"
            >
              The AI-powered system that shows up for your team every single day—with personalized coaching, daily audio briefs, and the <span className="text-primary-foreground font-medium">accountability that actually sticks.</span>
            </motion.p>

            <motion.div variants={fadeIn} className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
              <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 text-lg px-8 py-6 shadow-xl shadow-accent/30" onClick={handleDemoRequest}>
                Book a Demo
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </motion.div>

          </motion.div>
        </div>
        
        {/* Angled divider */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-highlight-gold" style={{ clipPath: 'polygon(0 100%, 100% 100%, 100% 0)' }} />
      </section>

      {/* PERSON - Who This Is For */}
      <section className="pt-8 pb-12 px-6 bg-highlight-gold relative">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="space-y-8"
          >
            <motion.div variants={fadeIn} className="text-center space-y-2">
              <p className="text-accent-foreground font-semibold uppercase tracking-wide text-sm">Who This Is For</p>
              <h2 className="text-3xl md:text-4xl font-bold text-primary">This Is For Leaders Who Know Goals Aren't Enough</h2>
            </motion.div>

            <motion.div variants={fadeIn} className="grid md:grid-cols-2 gap-4">
              {[
                "Have ambitious goals but inconsistent follow-through across the team",
                "Know that motivation fades—and need something that doesn't",
                "Want their people to grow without carrying the development load",
                "Ready to install a daily system that builds momentum over time"
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-5 bg-background/80 backdrop-blur-sm rounded-xl border border-primary/10 shadow-sm hover:shadow-md hover:bg-background transition-all duration-300">
                  <CheckCircle2 className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                  <p className="text-primary font-medium">{item}</p>
                </div>
              ))}
            </motion.div>

            <motion.div variants={fadeIn} className="bg-gradient-to-r from-primary to-primary/90 rounded-2xl p-6 text-center shadow-lg">
              <p className="text-primary-foreground/80 mb-1">You're not struggling because you're a bad leader.</p>
              <p className="text-lg text-primary-foreground font-semibold">You're struggling because your people don't yet have a system that shows up for them every single day.</p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <FlowArrow />

      {/* PROBLEM - The Real Frustration */}
      <section className="py-12 px-6 bg-background relative">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="space-y-8"
          >
            <motion.div variants={fadeIn} className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-destructive/10 border border-destructive/20">
                <span className="text-destructive font-semibold uppercase tracking-wide text-xs">The Real Problem</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold">On Paper, You Have Talent.</h2>
              <p className="text-lg text-muted-foreground">In reality, you're still...</p>
            </motion.div>

            <motion.div variants={fadeIn} className="flex flex-wrap justify-center gap-3">
              {[
                "Re-explaining expectations",
                "Re-selling the vision",
                "Cleaning up missed priorities",
                "Managing emotional 1:1s instead of developmental ones",
                "Watching capable people plateau instead of grow"
              ].map((item, i) => (
                <div key={i} className="px-4 py-2.5 bg-destructive/5 border border-destructive/15 rounded-full hover:bg-destructive/10 transition-colors">
                  <p className="text-foreground font-medium text-sm">{item}</p>
                </div>
              ))}
            </motion.div>

            <motion.div variants={fadeIn} className="bg-gradient-to-br from-primary via-primary to-primary/95 rounded-2xl p-8 text-center space-y-3 shadow-xl">
              <p className="text-primary-foreground/80">Your biggest frustration isn't effort. It's this:</p>
              <p className="text-xl md:text-2xl font-bold max-w-3xl mx-auto text-primary-foreground leading-snug">
                Your team wants to do great work — but they don't clearly know what "great" looks like in their role, or how to move themselves forward consistently.
              </p>
              <p className="text-lg text-accent font-semibold pt-1">And without that clarity, everything falls back on you.</p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <FlowArrow />

      {/* PROMISE - The Transformation */}
      <section className="py-12 px-6 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary/90" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-accent/10 rounded-full blur-[100px]" />
        
        <div className="max-w-5xl mx-auto relative">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="space-y-8"
          >
            <motion.div variants={fadeIn} className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/20 border border-accent/30">
                <Sparkles className="w-4 h-4 text-accent" />
                <span className="text-accent font-semibold uppercase tracking-wide text-xs">The Transformation</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold">From Hoping They'll Change → To a System That Delivers</h2>
            </motion.div>

            <motion.div variants={fadeIn} className="grid md:grid-cols-2 gap-6">
              <div className="bg-primary-foreground/5 backdrop-blur-sm rounded-xl p-6 border border-primary-foreground/10">
                <h3 className="text-lg font-semibold text-destructive/90 mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-destructive rounded-full" />
                  From:
                </h3>
                <ul className="space-y-3">
                  {["Goal-setting without follow-through", "Motivation that fades by February", "Training that's forgotten in a week", "Development that depends on leader bandwidth"].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-primary-foreground/70 text-sm">
                      <span className="w-1.5 h-1.5 bg-primary-foreground/40 rounded-full" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-gradient-to-br from-accent/20 to-accent/10 backdrop-blur-sm rounded-xl p-6 border border-accent/30">
                <h3 className="text-lg font-semibold text-accent mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  To:
                </h3>
                <ul className="space-y-3">
                  {["Daily coaching that never misses a day", "Personalized audio briefs every morning", "Habit tracking that builds real momentum", "An AI that knows your goals and helps you hit them"].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-primary-foreground font-medium text-sm">
                      <CheckCircle2 className="h-4 w-4 text-accent flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>

            <motion.div variants={fadeIn} className="text-center">
              <p className="text-xl font-medium max-w-3xl mx-auto">
                Your goals inspire. <span className="text-accent">Your system delivers.</span>
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <FlowArrow />

      {/* PROCESS - How Jericho Works */}
      <section className="py-14 px-6 bg-gradient-to-b from-background to-muted/30 relative">
        <SideFlowArrows direction="right" />
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="space-y-10"
          >
            <motion.div variants={fadeIn} className="text-center space-y-2">
              <p className="text-accent font-semibold uppercase tracking-wide text-sm">How It Works</p>
              <h2 className="text-3xl md:text-4xl font-bold">AI-Powered Coaching That Shows Up Every Day</h2>
            </motion.div>

            <motion.div variants={fadeIn} className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                {
                  icon: Headphones,
                  title: "1. Daily Growth Podcast",
                  description: "Wake up to a personalized audio brief about YOUR wins, YOUR goals, and YOUR next move."
                },
                {
                  icon: Mic,
                  title: "2. Conversational Coaching",
                  description: "Chat or talk to Jericho anytime—it knows your pipeline, your habits, and your history."
                },
                {
                  icon: Flame,
                  title: "3. Habit & Streak Tracking",
                  description: "Daily behaviors drive results. Watch your streaks grow and your momentum compound."
                },
                {
                  icon: FileText,
                  title: "4. AI-Powered 1:1 Prep",
                  description: "Data-backed agendas replace guesswork. Know exactly what to discuss with every team member."
                },
                {
                  icon: Route,
                  title: "5. Career Path Intelligence",
                  description: "See where you are, where you're going, and exactly how to get there with phased roadmaps."
                },
                {
                  icon: Target,
                  title: "6. Sales Intelligence",
                  description: "Customer history, call prep, and proposals—all from a conversation with Jericho."
                }
              ].map((step, i) => (
                <div key={i} className="group p-5 bg-card rounded-xl border border-border hover:border-accent/50 hover:shadow-lg hover:shadow-accent/5 transition-all duration-300">
                  <div className="w-12 h-12 bg-gradient-to-br from-accent/20 to-accent/10 rounded-xl flex items-center justify-center mb-4 group-hover:from-accent/30 group-hover:to-accent/20 transition-all">
                    <step.icon className="h-6 w-6 text-accent" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-primary">{step.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      <FlowArrow />

      {/* What This Changes for Leaders */}
      <section className="py-12 px-6 bg-highlight-gold relative">
        <SideFlowArrows direction="left" />
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="space-y-8"
          >
            <motion.div variants={fadeIn} className="text-center space-y-2">
              <p className="text-accent-foreground font-semibold uppercase tracking-wide text-sm">For Leaders</p>
              <h2 className="text-3xl md:text-4xl font-bold text-primary">What This Changes For You</h2>
            </motion.div>

            <motion.div variants={fadeIn} className="grid md:grid-cols-2 gap-5">
              <div className="bg-background/80 backdrop-blur-sm rounded-xl p-6 border border-muted">
                <h3 className="text-lg font-semibold text-muted-foreground mb-4">Less of this:</h3>
                <ul className="space-y-3">
                  {["Chasing", "Reminding", "Babysitting"].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-muted-foreground">
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-gradient-to-br from-primary to-primary/95 rounded-xl p-6 border border-accent/30 shadow-lg">
                <h3 className="text-lg font-semibold text-accent mb-4">More of this:</h3>
                <ul className="space-y-3">
                  {["Daily accountability without daily effort", "A system that remembers everything", "Team development on autopilot", "Your leadership capacity back"].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 font-medium text-primary-foreground">
                      <Zap className="h-4 w-4 text-accent" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>

            <motion.div variants={fadeIn} className="text-center">
              <p className="text-xl font-medium text-primary">
                Jericho doesn't replace leadership. <span className="text-accent">It scales leadership.</span>
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <FlowArrow />

      {/* PROOF - Why This Works + Logos */}
      <section className="py-14 px-6 bg-background">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="space-y-10"
          >
            <motion.div variants={fadeIn} className="text-center space-y-2">
              <p className="text-accent font-semibold uppercase tracking-wide text-sm">Why It Works</p>
              <h2 className="text-3xl md:text-4xl font-bold">Systems Beat Willpower. Every Time.</h2>
            </motion.div>

            <motion.div variants={fadeIn} className="grid sm:grid-cols-2 gap-4">
              {[
                "Systems beat willpower—Jericho shows up every day, even when motivation doesn't",
                "Personalization beats generic—every podcast, every nudge is tailored to the individual",
                "AI beats bandwidth—your team gets coaching without draining your time",
                "Data beats subjectivity—progress is visible, objective, and trackable"
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-4 bg-gradient-to-r from-accent/10 to-accent/5 rounded-xl border border-accent/20 hover:border-accent/40 transition-colors">
                  <CheckCircle2 className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                  <p className="font-medium text-primary">{item}</p>
                </div>
              ))}
            </motion.div>

            <motion.div variants={fadeIn} className="bg-gradient-to-br from-primary via-primary to-primary/95 rounded-2xl p-8 text-center space-y-3 shadow-xl">
              <p className="text-primary-foreground/70 text-sm">Instead of asking:</p>
              <p className="text-lg text-primary-foreground/80 italic">"How do I get my people to stay motivated?"</p>
              <p className="text-primary-foreground/70 text-sm">Leaders start saying:</p>
              <p className="text-xl font-bold text-accent">"My people have a system that moves them forward—every single day."</p>
            </motion.div>

            {/* Customer Logos */}
            <motion.div variants={fadeIn} className="space-y-4">
              <p className="text-center text-muted-foreground text-sm font-medium">Trusted by growth-minded organizations</p>
              <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12">
                <img src={loganLogo} alt="Logan Contractors" className="h-10 md:h-12 w-auto object-contain grayscale hover:grayscale-0 opacity-70 hover:opacity-100 transition-all duration-300" />
                <img src={iasLogo} alt="Innovative Ag Services" className="h-10 md:h-12 w-auto object-contain grayscale hover:grayscale-0 opacity-70 hover:opacity-100 transition-all duration-300" />
                <img src={winfieldLogo} alt="WinField United" className="h-8 md:h-10 w-auto object-contain grayscale hover:grayscale-0 opacity-70 hover:opacity-100 transition-all duration-300" />
                <img src={agPartnersLogo} alt="Ag Partners" className="h-10 md:h-12 w-auto object-contain grayscale hover:grayscale-0 opacity-70 hover:opacity-100 transition-all duration-300" />
                <img src={mcmLogo} alt="MCM" className="h-10 md:h-12 w-auto object-contain grayscale hover:grayscale-0 opacity-70 hover:opacity-100 transition-all duration-300" />
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <FlowArrow />

      {/* PRODUCT - What Jericho Is */}
      <section className="py-12 px-6 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/90" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-accent/10 rounded-full blur-[80px]" />
        
        <div className="max-w-5xl mx-auto relative">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="space-y-8"
          >
            <motion.div variants={fadeIn} className="text-center space-y-2">
              <p className="text-accent font-semibold uppercase tracking-wide text-sm">The Product</p>
              <h2 className="text-3xl md:text-4xl font-bold">Your Team's Daily Operating System</h2>
              <p className="text-primary-foreground/70">Not another task tool. An AI coach that never takes a day off.</p>
            </motion.div>

            <motion.div variants={fadeIn} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { icon: Headphones, text: "Personalized daily audio coaching" },
                { icon: Mic, text: "Conversational AI with voice support" },
                { icon: Flame, text: "Habit tracking with streak gamification" },
                { icon: Route, text: "Career path and capability mapping" },
                { icon: FileText, text: "1:1 meeting preparation" },
                { icon: Target, text: "Sales intelligence and customer history" }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-3.5 bg-primary-foreground/5 backdrop-blur-sm rounded-lg border border-primary-foreground/10 hover:bg-primary-foreground/10 transition-colors">
                  <item.icon className="h-5 w-5 text-accent flex-shrink-0" />
                  <p className="text-primary-foreground text-sm">{item.text}</p>
                </div>
              ))}
            </motion.div>

            <motion.p variants={fadeIn} className="text-center text-primary-foreground/70 text-sm">
              Jericho can run as a standalone system, or alongside your existing leadership or operating system.
            </motion.p>
          </motion.div>
        </div>
      </section>


      {/* PUSH - Final CTA */}
      <section className="py-16 px-6 bg-primary relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-accent/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-accent/10 rounded-full blur-[80px]" />
        
        <div className="max-w-4xl mx-auto relative">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="text-center space-y-6"
          >
            <motion.div variants={fadeIn} className="space-y-3">
              <h2 className="text-3xl md:text-5xl font-bold text-primary-foreground">
                Ready to Build a System That Never Stops?
              </h2>
              <p className="text-lg text-primary-foreground/80 max-w-2xl mx-auto">
                Your goals inspire. Your system delivers. Let Jericho be the daily engine that moves your team forward—one day, one habit, one win at a time.
              </p>
            </motion.div>

            <motion.div variants={fadeIn}>
              <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 text-lg px-10 py-6 shadow-xl shadow-accent/30" onClick={handleDemoRequest}>
                Book a Demo
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </motion.div>

            <motion.div variants={fadeIn} className="pt-2 space-y-3">
              <p className="text-primary-foreground/70 text-sm">On the call, we'll help you determine:</p>
              <ul className="inline-flex flex-col items-start gap-2 text-left">
                {[
                  "If Jericho fits your organization",
                  "Where clarity is breaking down now",
                  "What it would look like to scale leadership — not stress"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-accent" />
                    <span className="text-primary-foreground text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border bg-background">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-accent-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">Jericho</span>
          </Link>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
            <a href="#" className="hover:text-foreground transition-colors">Contact</a>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2025 Jericho. Your goals inspire. Your system delivers.
          </p>
        </div>
      </footer>
    </div>
    </>
  );
};

export default Sales;
