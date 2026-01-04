import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
  MoveDown
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

  const handleDemoRequest = () => {
    window.open('https://calendly.com/jericho-poulton/jericho-ai-demo', '_blank');
  };

  const handleTrialRequest = () => {
    window.location.href = `/auth?email=${encodeURIComponent(email)}&trial=true`;
  };

  return (
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
              Book a Clarity Call
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
              <Users className="w-4 h-4 text-accent" />
              <span className="text-accent font-medium text-sm">For leaders of 25–300 person organizations</span>
            </motion.div>
            
            <motion.h1 
              variants={fadeIn}
              className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight text-primary-foreground"
            >
              Scale Clarity.<br />
              Scale Ownership.<br />
              <span className="text-accent">Scale Leadership.</span>
            </motion.h1>
            
            <motion.p 
              variants={fadeIn}
              className="text-xl md:text-2xl text-primary-foreground/80 max-w-3xl mx-auto leading-relaxed"
            >
              Jericho is an AI-powered performance management system that teaches people how to define success, execute with clarity, and grow into mastery — <span className="text-primary-foreground font-medium">without leaders having to carry everything.</span>
            </motion.p>

            <motion.div variants={fadeIn} className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
              <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 text-lg px-8 py-6 shadow-xl shadow-accent/30" onClick={handleDemoRequest}>
                Book a Clarity Call
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8 py-6 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10" onClick={handleTrialRequest}>
                Start Free Trial
              </Button>
            </motion.div>

            <motion.div variants={fadeIn} className="flex flex-wrap items-center justify-center gap-6 text-sm text-primary-foreground/70">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-accent" />
                30-day free trial
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-accent" />
                No credit card required
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-accent" />
                SOC 2 Compliant
              </span>
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
              <h2 className="text-3xl md:text-4xl font-bold text-primary">This Is For Leaders Who Are...</h2>
            </motion.div>

            <motion.div variants={fadeIn} className="grid md:grid-cols-2 gap-4">
              {[
                "Running a 25–300 person organization",
                "Values-driven, growth-minded, and serious about execution",
                "Tired of being the bottleneck for clarity, accountability, and development",
                "Carrying too much in their head because systems haven't caught up to scale"
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-5 bg-background/80 backdrop-blur-sm rounded-xl border border-primary/10 shadow-sm hover:shadow-md hover:bg-background transition-all duration-300">
                  <CheckCircle2 className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                  <p className="text-primary font-medium">{item}</p>
                </div>
              ))}
            </motion.div>

            <motion.div variants={fadeIn} className="bg-gradient-to-r from-primary to-primary/90 rounded-2xl p-6 text-center shadow-lg">
              <p className="text-primary-foreground/80 mb-1">You're not struggling because you're a bad leader.</p>
              <p className="text-lg text-primary-foreground font-semibold">You're struggling because your people don't yet have a system that teaches them how to lead themselves.</p>
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
              <h2 className="text-3xl md:text-4xl font-bold">From Carrying Everything → To Scaling Leadership</h2>
            </motion.div>

            <motion.div variants={fadeIn} className="grid md:grid-cols-2 gap-6">
              <div className="bg-primary-foreground/5 backdrop-blur-sm rounded-xl p-6 border border-primary-foreground/10">
                <h3 className="text-lg font-semibold text-destructive/90 mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-destructive rounded-full" />
                  From:
                </h3>
                <ul className="space-y-3">
                  {["Ambiguity", "Leader-dependence", "Reactive execution", "Subjective performance conversations"].map((item, i) => (
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
                  {["Clear role ownership", "Focused execution", "Objective growth paths", "People who think, plan, and progress independently"].map((item, i) => (
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
                Jericho gives your people clarity — and gives you your <span className="text-accent">leadership capacity back.</span>
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
              <h2 className="text-3xl md:text-4xl font-bold">A Simple, Repeatable System for Clarity & Momentum</h2>
            </motion.div>

            <motion.div variants={fadeIn} className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                {
                  icon: Target,
                  title: "1. Define Success Clearly",
                  description: "Each employee knows what they own, what 'great' looks like, and how success is measured."
                },
                {
                  icon: TrendingUp,
                  title: "2. Build Vision at the Right Altitude",
                  description: "Employees create 1–3 year role visions and quarterly targets. They learn how to choose the right priorities."
                },
                {
                  icon: Calendar,
                  title: "3. Execute with Rhythm",
                  description: "Quarterly targets → 30-day benchmarks → 7-day sprints. Always the next right move."
                },
                {
                  icon: BarChart3,
                  title: "4. Track the Habits That Matter",
                  description: "Daily behaviors drive real results. Leading indicators replace reactive firefighting."
                },
                {
                  icon: Sparkles,
                  title: "5. Grow Into Mastery",
                  description: "Clear capability levels show where someone is, what 'better' looks like, and what to work on next."
                },
                {
                  icon: MessageSquare,
                  title: "6. Transform 1:1s",
                  description: "Data-backed performance agendas replace emotional check-ins. Conversations become focused and developmental."
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
                  {["Ownership", "Consistency", "Faster development", "Stronger execution"].map((item, i) => (
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
              <h2 className="text-3xl md:text-4xl font-bold">Jericho Solves What Most Systems Avoid</h2>
            </motion.div>

            <motion.div variants={fadeIn} className="grid sm:grid-cols-2 gap-4">
              {[
                "Removes subjectivity from performance",
                "Gives leaders and employees shared language",
                "Replaces emotional conversations with objective clarity",
                "Turns development into something people can actually see"
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-4 bg-gradient-to-r from-accent/10 to-accent/5 rounded-xl border border-accent/20 hover:border-accent/40 transition-colors">
                  <CheckCircle2 className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                  <p className="font-medium text-primary">{item}</p>
                </div>
              ))}
            </motion.div>

            <motion.div variants={fadeIn} className="bg-gradient-to-br from-primary via-primary to-primary/95 rounded-2xl p-8 text-center space-y-3 shadow-xl">
              <p className="text-primary-foreground/70 text-sm">Instead of asking:</p>
              <p className="text-lg text-primary-foreground/80 italic">"How do I get my people to care more?"</p>
              <p className="text-primary-foreground/70 text-sm">Leaders start saying:</p>
              <p className="text-xl font-bold text-accent">"My people finally know how to move themselves forward."</p>
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
              <h2 className="text-3xl md:text-4xl font-bold">A Performance Management & Growth System</h2>
              <p className="text-primary-foreground/70">Not another task tool.</p>
            </motion.div>

            <motion.div variants={fadeIn} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { icon: Target, text: "Role-specific success definitions" },
                { icon: TrendingUp, text: "Vision and execution planning tools" },
                { icon: BarChart3, text: "Habit tracking for leading indicators" },
                { icon: Sparkles, text: "Capability mastery pathways" },
                { icon: Brain, text: "Hyper-personalized AI insights and training" },
                { icon: MessageSquare, text: "Structured, data-backed 1:1 agendas" }
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
                Ready to Stop Carrying Everything?
              </h2>
              <p className="text-lg text-primary-foreground/80 max-w-2xl mx-auto">
                Build a team that knows what success looks like, executes without constant oversight, and grows into mastery over time.
              </p>
            </motion.div>

            <motion.div variants={fadeIn}>
              <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 text-lg px-10 py-6 shadow-xl shadow-accent/30" onClick={handleDemoRequest}>
                Book a Jericho Clarity Call
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

            <motion.div variants={fadeIn} className="flex items-center justify-center gap-5 pt-4 text-xs text-primary-foreground/60">
              <span className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                SOC 2 Compliant
              </span>
              <span>•</span>
              <span>No credit card required</span>
              <span>•</span>
              <span>30-day free trial</span>
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
            © 2025 Jericho. Scale leadership, not stress.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Sales;
