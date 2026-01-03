import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { 
  ArrowRight,
  CheckCircle2,
  Sparkles,
  XCircle,
  TrendingUp,
  MessageCircle,
  Target,
  Users,
  Clock,
  AlertTriangle,
  Zap,
  BarChart3,
  Heart,
  RefreshCw
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

const Landing = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-accent-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground">Jericho</span>
              <span className="hidden sm:inline text-xs text-muted-foreground ml-1">by The Momentum Company</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#problem" className="text-sm text-muted-foreground hover:text-accent transition-colors">The Problem</a>
              <a href="#solution" className="text-sm text-muted-foreground hover:text-accent transition-colors">Our Solution</a>
              <a href="#results" className="text-sm text-muted-foreground hover:text-accent transition-colors">Results</a>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/auth">
                <Button variant="outline" size="sm">Log In</Button>
              </Link>
              <Link to="/auth" className="hidden sm:block">
                <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section - Bold Problem Statement */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="absolute top-20 right-10 w-72 h-72 bg-accent/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        
        <motion.div 
          className="max-w-7xl mx-auto relative"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          <div className="text-center max-w-4xl mx-auto">
            <motion.div 
              variants={fadeIn}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-destructive/10 text-destructive text-sm font-medium mb-6 border border-destructive/20"
            >
              <AlertTriangle className="w-4 h-4" />
              Performance management is broken
            </motion.div>
            
            <motion.h1 
              variants={fadeIn}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight"
            >
              <span className="text-destructive">66%</span> of employees hate their reviews.{" "}
              <span className="text-accent">We fixed that.</span>
            </motion.h1>
            
            <motion.p 
              variants={fadeIn}
              className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto"
            >
              Stop wasting millions on annual reviews that hurt performance. 
              Jericho replaces outdated paperwork with continuous AI coaching that actually develops your people.
            </motion.p>
            
            <motion.div variants={fadeIn} className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/auth">
                <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2 text-lg px-8">
                  See It In Action
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <a href="#problem">
                <Button variant="outline" size="lg" className="gap-2 text-lg px-8">
                  Learn Why Reviews Fail
                </Button>
              </a>
            </motion.div>
          </div>
          
          {/* Hero Stats */}
          <motion.div 
            variants={fadeIn}
            className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {[
              { stat: "66%", label: "of employees dissatisfied with reviews", negative: true },
              { stat: "95%", label: "of managers hate the process", negative: true },
              { stat: "4.2x", label: "more likely to outperform competitors", negative: false },
              { stat: "30%", label: "higher revenue growth", negative: false },
            ].map((item, i) => (
              <div 
                key={i} 
                className={`rounded-xl p-6 text-center border ${
                  item.negative 
                    ? 'bg-destructive/5 border-destructive/20' 
                    : 'bg-accent/10 border-accent/30'
                }`}
              >
                <div className={`text-3xl sm:text-4xl font-bold mb-2 ${
                  item.negative ? 'text-destructive' : 'text-accent'
                }`}>
                  {item.stat}
                </div>
                <div className="text-sm text-muted-foreground">{item.label}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* The Problem Section */}
      <section id="problem" className="py-20 px-4 sm:px-6 lg:px-8 bg-primary text-primary-foreground">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Annual Reviews Don't Just Fail—They Make Things Worse
            </h2>
            <p className="text-xl text-primary-foreground/80 max-w-3xl mx-auto">
              In a third of cases, traditional reviews actually <span className="font-bold text-destructive">hurt performance</span> instead of improving it. 
              Companies burn $2.4–$35 million per 10,000 employees on a process that doesn't work.
            </p>
          </motion.div>
          
          <motion.div 
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {[
              {
                icon: AlertTriangle,
                title: "Surprise Attacks",
                stat: "14%",
                statLabel: "feel inspired to improve",
                description: "Waiting 12 months to give feedback erodes trust. Only 14% say reviews actually inspire them."
              },
              {
                icon: Users,
                title: "Talent Exodus",
                stat: "63%",
                statLabel: "quit due to no advancement",
                description: "Your best people leave because they don't see a path forward. No coaching, no growth, no loyalty."
              },
              {
                icon: Clock,
                title: "Too Late to Matter",
                stat: "~50%",
                statLabel: "get feedback yearly or less",
                description: "By the time you rehash issues, the moment has passed. Nobody can course-correct in real time."
              },
              {
                icon: XCircle,
                title: "Manager Burnout",
                stat: "95%",
                statLabel: "of managers hate the process",
                description: "Piecing together foggy memories, filling clunky forms, sitting through uncomfortable conversations."
              }
            ].map((item, i) => (
              <motion.div 
                key={i} 
                variants={fadeIn}
                className="bg-primary-foreground/10 rounded-xl p-6 border border-primary-foreground/20"
              >
                <div className="w-12 h-12 rounded-xl bg-destructive/20 flex items-center justify-center mb-4">
                  <item.icon className="w-6 h-6 text-destructive" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <div className="text-2xl font-bold text-destructive mb-1">{item.stat}</div>
                <div className="text-xs text-primary-foreground/60 mb-3">{item.statLabel}</div>
                <p className="text-sm text-primary-foreground/80">{item.description}</p>
              </motion.div>
            ))}
          </motion.div>
          
          <motion.div 
            className="mt-12 text-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
          >
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-destructive/20 text-destructive-foreground">
              <span className="text-lg font-medium">
                73% of Gen Z will leave if they don't get frequent feedback
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* The Solution Section */}
      <section id="solution" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/20 text-accent-foreground text-sm font-medium mb-6 border border-accent/30">
              <Sparkles className="w-4 h-4 text-accent" />
              The Better Way
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Continuous Coaching That Actually Works
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Instead of one high-stakes conversation per year, Jericho delivers ongoing AI coaching 
              in the flow of work. Feedback becomes timely, relevant, and focused on growth.
            </p>
          </motion.div>
          
          {/* Before/After Comparison */}
          <motion.div 
            className="grid md:grid-cols-2 gap-8 mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            <motion.div variants={fadeIn}>
              <Card className="h-full bg-destructive/5 border-destructive/20">
                <CardContent className="p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
                      <XCircle className="w-5 h-5 text-destructive" />
                    </div>
                    <h3 className="text-xl font-semibold text-destructive">Annual Reviews</h3>
                  </div>
                  <ul className="space-y-4">
                    {[
                      "One stressful conversation per year",
                      "Recency bias dominates evaluations",
                      "Managers scramble to remember details",
                      "Employees blindsided by feedback",
                      "Paperwork nightmare for everyone",
                      "No real-time course correction",
                      "Goals set once, forgotten quickly"
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-muted-foreground">
                        <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
            
            <motion.div variants={fadeIn}>
              <Card className="h-full bg-accent/10 border-accent/30">
                <CardContent className="p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-accent" />
                    </div>
                    <h3 className="text-xl font-semibold text-accent">Jericho's Continuous Model</h3>
                  </div>
                  <ul className="space-y-4">
                    {[
                      "Ongoing coaching conversations",
                      "AI tracks performance all year long",
                      "Evidence-based, bias-free feedback",
                      "Employees always know where they stand",
                      "Managers coach, not judge",
                      "Real-time development adjustments",
                      "Goals adapt quarter by quarter"
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-foreground">
                        <CheckCircle2 className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
          
          {/* Key Features */}
          <motion.div 
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {[
              {
                icon: MessageCircle,
                title: "AI Coaching 24/7",
                description: "Meet Jericho, your personal AI career coach. Get guidance anytime—not just during scheduled reviews."
              },
              {
                icon: Target,
                title: "Capability Mapping",
                description: "AI analyzes roles and creates personalized development paths. Everyone knows exactly what to work on."
              },
              {
                icon: TrendingUp,
                title: "Growth Roadmaps",
                description: "Clear 90-day sprints, 1-year milestones, and 3-year visions. Progress you can see and measure."
              },
              {
                icon: BarChart3,
                title: "Manager Insights",
                description: "Real-time team analytics, capability gaps, and actionable recommendations. Lead with data, not guesswork."
              },
              {
                icon: RefreshCw,
                title: "Continuous Feedback",
                description: "Weekly check-ins, not annual surprises. Employees with weekly 1:1s are 61% more engaged."
              },
              {
                icon: Heart,
                title: "Recognition Built In",
                description: "Celebrate wins as they happen. Engaged employees don't just perform—they stay and build."
              }
            ].map((feature, i) => (
              <motion.div key={i} variants={fadeIn}>
                <Card className="h-full group hover:shadow-lg transition-all duration-300 hover:border-accent/50 hover:shadow-accent/10">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center mb-4 group-hover:bg-accent/30 transition-colors">
                      <feature.icon className="w-6 h-6 text-accent" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Results Section */}
      <section id="results" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              The Results Speak for Themselves
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Companies that prioritize continuous development don't just improve morale—they outperform competitors.
            </p>
          </motion.div>
          
          <motion.div 
            className="grid md:grid-cols-3 gap-8 mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {[
              {
                stat: "4.2x",
                label: "More likely to outperform",
                description: "Companies prioritizing people performance crush their competition.",
                source: "McKinsey"
              },
              {
                stat: "40%",
                label: "Higher engagement",
                description: "Organizations that shifted to continuous feedback saw engagement soar.",
                source: "Gallup"
              },
              {
                stat: "30%",
                label: "Reduction in turnover",
                description: "Adobe saw dramatic retention improvements after moving to check-ins.",
                source: "Adobe Case Study"
              }
            ].map((item, i) => (
              <motion.div 
                key={i} 
                variants={fadeIn}
                className="bg-background rounded-2xl p-8 border border-accent/30 shadow-lg text-center"
              >
                <div className="text-5xl font-bold text-accent mb-2">{item.stat}</div>
                <div className="text-lg font-semibold text-foreground mb-2">{item.label}</div>
                <p className="text-muted-foreground mb-4">{item.description}</p>
                <div className="text-xs text-muted-foreground/60">Source: {item.source}</div>
              </motion.div>
            ))}
          </motion.div>
          
          {/* Engagement Insight */}
          <motion.div 
            className="bg-gradient-to-r from-primary to-primary/90 rounded-2xl p-8 md:p-12 text-primary-foreground"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
          >
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="text-2xl sm:text-3xl font-bold mb-4">
                  80% of employees who get meaningful feedback weekly are fully engaged
                </h3>
                <p className="text-primary-foreground/80 mb-6">
                  That's not a coincidence. Feedback is fuel. When your people know how they're doing 
                  and see a path to grow, they lean in. They stay. They multiply your impact.
                </p>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-accent">3.6x</div>
                    <div className="text-sm text-primary-foreground/60">more motivated</div>
                  </div>
                  <div className="h-12 w-px bg-primary-foreground/20" />
                  <div className="text-sm text-primary-foreground/80">
                    Employees who receive daily feedback vs. annual reviews
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Current US Engagement", value: "31%", negative: true },
                  { label: "With Weekly Feedback", value: "80%", negative: false },
                  { label: "Without 1:1s Engaged", value: "15%", negative: true },
                  { label: "With Weekly 1:1s", value: "61%", negative: false },
                ].map((item, i) => (
                  <div 
                    key={i} 
                    className={`rounded-xl p-4 text-center ${
                      item.negative 
                        ? 'bg-destructive/20' 
                        : 'bg-accent/20'
                    }`}
                  >
                    <div className={`text-2xl font-bold ${
                      item.negative ? 'text-destructive' : 'text-accent'
                    }`}>
                      {item.value}
                    </div>
                    <div className="text-xs text-primary-foreground/60">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Getting Started Is Simple
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Transform your performance culture in weeks, not years.
            </p>
          </motion.div>
          
          <motion.div 
            className="grid md:grid-cols-3 gap-8"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {[
              {
                step: "01",
                title: "Map Your Capabilities",
                description: "AI analyzes your roles and creates personalized capability frameworks. Every employee gets clear expectations and a development path."
              },
              {
                step: "02",
                title: "Enable Continuous Coaching",
                description: "Replace annual reviews with ongoing AI-powered conversations. Jericho coaches your people in the flow of work—24/7, no scheduling needed."
              },
              {
                step: "03",
                title: "Track & Iterate",
                description: "Real-time dashboards show engagement, capability growth, and retention risk. Adjust goals quarterly to stay aligned with business needs."
              }
            ].map((item, i) => (
              <motion.div key={i} variants={fadeIn} className="relative">
                <div className="text-7xl font-bold text-accent/20 mb-4">{item.step}</div>
                <h3 className="text-xl font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
                {i < 2 && (
                  <ArrowRight className="hidden md:block absolute top-10 -right-4 w-8 h-8 text-accent/50" />
                )}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center text-sm text-muted-foreground mb-8">
            Companies that made the shift to continuous performance management
          </div>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-60">
            {["Adobe", "Microsoft", "Accenture", "GE", "Deloitte"].map((company) => (
              <div key={company} className="text-xl font-semibold text-foreground">
                {company}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-accent">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-accent-foreground mb-4">
              Stop Burning Money on Broken Reviews
            </h2>
            <p className="text-xl text-accent-foreground/80 mb-8">
              Join the companies that turned performance management from paperwork into progress.
              Your people—and your bottom line—will thank you.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/auth">
                <Button size="lg" variant="secondary" className="gap-2 text-lg px-8">
                  Get Started Free
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <div className="text-accent-foreground/80">
                or text <span className="font-bold">"Jericho"</span> to{" "}
                <a href="sms:4028819986?body=Jericho" className="font-bold hover:underline">
                  402.881.9986
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-accent-foreground" />
              </div>
              <span className="text-lg font-bold text-foreground">Jericho</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link to="/academy" className="hover:text-accent transition-colors">Academy</Link>
              <a href="#" className="hover:text-accent transition-colors">Privacy</a>
              <a href="#" className="hover:text-accent transition-colors">Terms</a>
              <a href="#" className="hover:text-accent transition-colors">Contact</a>
            </div>
            <div className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} The Momentum Company
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-border text-center text-xs text-muted-foreground/60">
            Sources: Gallup, McKinsey, Pew Research, Fortune, Lattice, ThriveSparrow
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
