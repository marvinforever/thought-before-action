import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { 
  ArrowRight, 
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
  Shield
} from "lucide-react";

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

const Sales = () => {
  const [email, setEmail] = useState("");

  const handleDemoRequest = () => {
    window.open('https://calendly.com/jericho-poulton/jericho-ai-demo', '_blank');
  };

  const handleTrialRequest = () => {
    window.location.href = `/auth?email=${encodeURIComponent(email)}&trial=true`;
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center shadow-lg shadow-accent/30">
              <Sparkles className="w-6 h-6 text-accent-foreground" />
            </div>
            <div>
              <span className="text-xl font-bold text-foreground">Jericho</span>
              <span className="hidden sm:block text-[10px] text-muted-foreground -mt-1">by The Momentum Company</span>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/auth">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Button onClick={handleDemoRequest}>
              Book a Clarity Call
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero - Promise Forward */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="space-y-8"
          >
            <motion.p variants={fadeIn} className="text-primary font-medium text-lg">
              For leaders of 25–300 person organizations
            </motion.p>
            
            <motion.h1 
              variants={fadeIn}
              className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight"
            >
              Scale Clarity.<br />
              Scale Ownership.<br />
              <span className="text-primary">Scale Leadership.</span>
            </motion.h1>
            
            <motion.p 
              variants={fadeIn}
              className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed"
            >
              Jericho is an AI-powered performance management system that teaches people how to define success, execute with clarity, and grow into mastery — <span className="text-foreground font-medium">without leaders having to carry everything.</span>
            </motion.p>

            <motion.div variants={fadeIn} className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button size="lg" className="text-lg px-8 py-6" onClick={handleDemoRequest}>
                Book a Clarity Call
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8 py-6" onClick={handleTrialRequest}>
                Start Free Trial
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* PERSON - Who This Is For */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="space-y-12"
          >
            <motion.div variants={fadeIn} className="text-center space-y-4">
              <p className="text-primary font-medium">WHO THIS IS FOR</p>
              <h2 className="text-3xl md:text-4xl font-bold">This Is For Leaders Who Are...</h2>
            </motion.div>

            <motion.div variants={fadeIn} className="grid md:grid-cols-2 gap-6">
              {[
                "Running a 25–300 person organization",
                "Values-driven, growth-minded, and serious about execution",
                "Tired of being the bottleneck for clarity, accountability, and development",
                "Carrying too much in their head because systems haven't caught up to scale"
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-4 p-6 bg-background rounded-xl border border-border">
                  <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-lg">{item}</p>
                </div>
              ))}
            </motion.div>

            <motion.p variants={fadeIn} className="text-center text-xl text-muted-foreground max-w-3xl mx-auto">
              You're not struggling because you're a bad leader.<br />
              <span className="text-foreground font-medium">You're struggling because your people don't yet have a system that teaches them how to lead themselves.</span>
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* PROBLEM - The Real Frustration */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="space-y-12"
          >
            <motion.div variants={fadeIn} className="text-center space-y-4">
              <p className="text-destructive font-medium">THE REAL PROBLEM</p>
              <h2 className="text-3xl md:text-4xl font-bold">On Paper, You Have Talent.</h2>
              <p className="text-xl text-muted-foreground">In reality, you're still...</p>
            </motion.div>

            <motion.div variants={fadeIn} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                "Re-explaining expectations",
                "Re-selling the vision",
                "Cleaning up missed priorities",
                "Managing emotional 1:1s instead of developmental ones",
                "Watching capable people plateau instead of grow"
              ].map((item, i) => (
                <div key={i} className="p-5 bg-destructive/5 border border-destructive/20 rounded-lg">
                  <p className="text-muted-foreground">{item}</p>
                </div>
              ))}
            </motion.div>

            <motion.div variants={fadeIn} className="bg-muted/50 rounded-2xl p-8 md:p-12 text-center space-y-4">
              <p className="text-xl text-muted-foreground">Your biggest frustration isn't effort. It's this:</p>
              <p className="text-2xl md:text-3xl font-bold max-w-3xl mx-auto">
                Your team wants to do great work — but they don't clearly know what "great" looks like in their role, or how to move themselves forward consistently.
              </p>
              <p className="text-xl text-primary font-medium">And without that clarity, everything falls back on you.</p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* PROMISE - The Transformation */}
      <section className="py-20 px-6 bg-primary/5">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="space-y-12"
          >
            <motion.div variants={fadeIn} className="text-center space-y-4">
              <p className="text-primary font-medium">THE TRANSFORMATION</p>
              <h2 className="text-3xl md:text-4xl font-bold">From Carrying Everything → To Scaling Leadership</h2>
            </motion.div>

            <motion.div variants={fadeIn} className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-destructive">From:</h3>
                <ul className="space-y-3">
                  {["Ambiguity", "Leader-dependence", "Reactive execution", "Subjective performance conversations"].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-muted-foreground">
                      <span className="w-2 h-2 bg-destructive rounded-full" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-primary">To:</h3>
                <ul className="space-y-3">
                  {["Clear role ownership", "Focused execution", "Objective growth paths", "People who think, plan, and progress independently"].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-foreground font-medium">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>

            <motion.p variants={fadeIn} className="text-center text-2xl font-medium max-w-3xl mx-auto">
              Jericho gives your people clarity — and gives you your leadership capacity back.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* PROCESS - How Jericho Works */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="space-y-16"
          >
            <motion.div variants={fadeIn} className="text-center space-y-4">
              <p className="text-primary font-medium">HOW IT WORKS</p>
              <h2 className="text-3xl md:text-4xl font-bold">A Simple, Repeatable System for Clarity & Momentum</h2>
            </motion.div>

            <motion.div variants={fadeIn} className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                {
                  icon: Target,
                  title: "1. Define Success Clearly",
                  description: "Each employee knows what they own, what 'great' looks like, and how success is measured. No vague expectations. No guessing."
                },
                {
                  icon: TrendingUp,
                  title: "2. Build Vision at the Right Altitude",
                  description: "Employees create 1–3 year role visions and quarterly targets. They learn how to choose the right priorities, not just more goals."
                },
                {
                  icon: Calendar,
                  title: "3. Execute with Rhythm",
                  description: "Quarterly targets → 30-day benchmarks → 7-day sprints. Always the next right move. No overwhelm."
                },
                {
                  icon: BarChart3,
                  title: "4. Track the Habits That Matter",
                  description: "Daily behaviors drive real results. Leading indicators replace reactive firefighting."
                },
                {
                  icon: Sparkles,
                  title: "5. Grow Into Mastery",
                  description: "Clear capability levels show where someone is, what 'better' looks like, and what to work on next. Growth becomes visible and motivating."
                },
                {
                  icon: MessageSquare,
                  title: "6. Transform 1:1s",
                  description: "Data-backed performance agendas replace emotional check-ins. Conversations become focused, developmental, and forward-moving."
                }
              ].map((step, i) => (
                <div key={i} className="p-6 bg-muted/30 rounded-xl border border-border hover:border-primary/50 transition-colors">
                  <step.icon className="h-10 w-10 text-primary mb-4" />
                  <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* What This Changes for Leaders */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="space-y-12"
          >
            <motion.div variants={fadeIn} className="text-center space-y-4">
              <p className="text-primary font-medium">FOR LEADERS</p>
              <h2 className="text-3xl md:text-4xl font-bold">What This Changes For You</h2>
            </motion.div>

            <motion.div variants={fadeIn} className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-muted-foreground">Less of this:</h3>
                <ul className="space-y-3">
                  {["Chasing", "Reminding", "Babysitting"].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-lg text-muted-foreground">
                      <span className="w-2 h-2 bg-muted-foreground rounded-full" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-primary">More of this:</h3>
                <ul className="space-y-3">
                  {["Ownership", "Consistency", "Faster development", "Stronger execution"].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-lg font-medium">
                      <Zap className="h-5 w-5 text-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>

            <motion.p variants={fadeIn} className="text-center text-2xl font-medium">
              Jericho doesn't replace leadership. <span className="text-primary">It scales leadership.</span>
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* PROOF - Why This Works + Logos */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="space-y-16"
          >
            <motion.div variants={fadeIn} className="text-center space-y-4">
              <p className="text-primary font-medium">WHY IT WORKS</p>
              <h2 className="text-3xl md:text-4xl font-bold">Jericho Solves What Most Systems Avoid</h2>
            </motion.div>

            <motion.div variants={fadeIn} className="grid sm:grid-cols-2 gap-6">
              {[
                "Removes subjectivity from performance",
                "Gives leaders and employees shared language",
                "Replaces emotional conversations with objective clarity",
                "Turns development into something people can actually see"
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-4 p-6 bg-primary/5 rounded-xl border border-primary/20">
                  <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-lg">{item}</p>
                </div>
              ))}
            </motion.div>

            <motion.div variants={fadeIn} className="bg-muted/50 rounded-2xl p-8 md:p-12 text-center space-y-4">
              <p className="text-muted-foreground">Instead of asking:</p>
              <p className="text-xl text-muted-foreground italic">"How do I get my people to care more?"</p>
              <p className="text-muted-foreground">Leaders start saying:</p>
              <p className="text-2xl font-bold text-primary">"My people finally know how to move themselves forward."</p>
            </motion.div>

            {/* Customer Logos Placeholder */}
            <motion.div variants={fadeIn} className="space-y-6">
              <p className="text-center text-muted-foreground font-medium">Trusted by growth-minded organizations</p>
              <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12 opacity-60">
                {/* Placeholder boxes for customer logos */}
                {[1, 2, 3, 4, 5].map((i) => (
                  <div 
                    key={i} 
                    className="w-32 h-12 bg-muted rounded-lg flex items-center justify-center text-muted-foreground text-sm"
                  >
                    Logo {i}
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* PRODUCT - What Jericho Is */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="space-y-12"
          >
            <motion.div variants={fadeIn} className="text-center space-y-4">
              <p className="text-primary font-medium">THE PRODUCT</p>
              <h2 className="text-3xl md:text-4xl font-bold">A Performance Management & Growth System</h2>
              <p className="text-xl text-muted-foreground">Not another task tool.</p>
            </motion.div>

            <motion.div variants={fadeIn} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { icon: Target, text: "Role-specific success definitions" },
                { icon: TrendingUp, text: "Vision and execution planning tools" },
                { icon: BarChart3, text: "Habit tracking for leading indicators" },
                { icon: Sparkles, text: "Capability mastery pathways" },
                { icon: Brain, text: "Hyper-personalized AI insights and training" },
                { icon: MessageSquare, text: "Structured, data-backed 1:1 agendas" }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-4 bg-background rounded-lg border border-border">
                  <item.icon className="h-5 w-5 text-primary flex-shrink-0" />
                  <p>{item.text}</p>
                </div>
              ))}
            </motion.div>

            <motion.p variants={fadeIn} className="text-center text-muted-foreground">
              Jericho can run as a standalone system, or alongside your existing leadership or operating system.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* PRICE + PLACE */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="space-y-12"
          >
            <motion.div variants={fadeIn} className="grid md:grid-cols-2 gap-8">
              {/* Price */}
              <div className="p-8 bg-muted/30 rounded-2xl border border-border space-y-6">
                <div className="space-y-2">
                  <p className="text-primary font-medium text-sm">INVESTMENT</p>
                  <h3 className="text-2xl font-bold">Simple, Transparent Pricing</h3>
                </div>
                <div className="space-y-4">
                  <p className="text-4xl font-bold">~$500<span className="text-lg text-muted-foreground font-normal">/employee/year</span></p>
                  <p className="text-muted-foreground">Exact pricing depends on team size, rollout scope, and support level.</p>
                  <p className="text-sm text-muted-foreground">We'll walk through this on your clarity call.</p>
                </div>
              </div>

              {/* Place */}
              <div className="p-8 bg-muted/30 rounded-2xl border border-border space-y-6">
                <div className="space-y-2">
                  <p className="text-primary font-medium text-sm">DELIVERY</p>
                  <h3 className="text-2xl font-bold">How It's Delivered</h3>
                </div>
                <ul className="space-y-3">
                  {[
                    "Fully virtual platform",
                    "Works across departments and roles",
                    "Designed for real-world execution",
                    "Supports leaders and employees simultaneously",
                    "No long implementation cycles",
                    "No heavy lift for your team"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* PUSH - Final CTA */}
      <section className="py-24 px-6 bg-primary/5">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="text-center space-y-8"
          >
            <motion.div variants={fadeIn} className="space-y-4">
              <h2 className="text-3xl md:text-5xl font-bold">
                Ready to Stop Carrying Everything?
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Build a team that knows what success looks like, executes without constant oversight, and grows into mastery over time.
              </p>
            </motion.div>

            <motion.div variants={fadeIn}>
              <Button size="lg" className="text-lg px-10 py-6" onClick={handleDemoRequest}>
                Book a Jericho Clarity Call
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </motion.div>

            <motion.div variants={fadeIn} className="pt-4 space-y-4">
              <p className="text-muted-foreground">On the call, we'll help you determine:</p>
              <ul className="inline-flex flex-col items-start gap-2 text-left">
                {[
                  "If Jericho fits your organization",
                  "Where clarity is breaking down now",
                  "What it would look like to scale leadership — not stress"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div variants={fadeIn} className="flex items-center justify-center gap-6 pt-8 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
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
      <footer className="py-12 px-6 border-t border-border">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
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
            © 2024 Jericho. Scale leadership, not stress.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Sales;
