import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  Play,
  Calendar,
  Zap,
  BarChart3,
  Heart,
  Shield,
  Star,
  Quote,
  ChevronRight,
  Brain,
  Rocket,
  Award,
  Clock,
  DollarSign,
  AlertTriangle
} from "lucide-react";

const fadeIn = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7 } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5 } }
};

const Sales = () => {
  const [email, setEmail] = useState("");

  const handleDemoRequest = () => {
    // In production, this would integrate with a scheduling tool like Calendly
    window.open("https://calendly.com/jericho-demo", "_blank");
  };

  const handleTrialRequest = () => {
    if (email) {
      // In production, this would trigger a signup flow
      window.location.href = `/auth?email=${encodeURIComponent(email)}&trial=true`;
    }
  };

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center shadow-lg shadow-accent/30">
                <Sparkles className="w-6 h-6 text-accent-foreground" />
              </div>
              <div>
                <span className="text-xl font-bold text-foreground">Jericho</span>
                <span className="hidden sm:block text-[10px] text-muted-foreground -mt-1">by The Momentum Company</span>
              </div>
            </Link>
            <div className="hidden md:flex items-center gap-8">
              <a href="#why" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Why Jericho</a>
              <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
              <a href="#proof" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Results</a>
              <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/auth">
                <Button variant="ghost" size="sm">Log In</Button>
              </Link>
              <Button 
                size="sm" 
                className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg shadow-accent/30"
                onClick={handleDemoRequest}
              >
                Book Demo
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* HERO SECTION - Maximum Impact */}
      <section className="pt-28 pb-20 px-4 sm:px-6 lg:px-8 relative">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-accent/5 via-transparent to-transparent" />
        <div className="absolute top-32 -right-32 w-[500px] h-[500px] bg-accent/20 rounded-full blur-[120px]" />
        <div className="absolute top-64 -left-32 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px]" />
        
        <motion.div 
          className="max-w-6xl mx-auto relative"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          <div className="text-center">
            {/* Urgency Badge */}
            <motion.div 
              variants={fadeIn}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-destructive/10 text-destructive text-sm font-semibold mb-8 border border-destructive/20"
            >
              <AlertTriangle className="w-4 h-4" />
              Your top performers are 3x more likely to leave without career development
            </motion.div>
            
            {/* Main Headline */}
            <motion.h1 
              variants={fadeIn}
              className="text-5xl sm:text-6xl lg:text-7xl font-black text-foreground mb-6 leading-[1.1] tracking-tight"
            >
              Stop Losing Talent.<br />
              <span className="bg-gradient-to-r from-accent via-accent to-accent/80 bg-clip-text text-transparent">
                Start Growing Them.
              </span>
            </motion.h1>
            
            {/* Subheadline */}
            <motion.p 
              variants={fadeIn}
              className="text-xl sm:text-2xl text-muted-foreground mb-10 max-w-3xl mx-auto leading-relaxed"
            >
              Jericho is the AI-powered growth platform that turns annual review nightmares 
              into continuous development wins. <span className="text-foreground font-semibold">See results in 30 days.</span>
            </motion.p>
            
            {/* CTA Section */}
            <motion.div 
              variants={fadeIn}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8"
            >
              <Button 
                size="lg" 
                className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2 text-lg px-10 h-14 shadow-xl shadow-accent/30 font-semibold"
                onClick={handleDemoRequest}
              >
                <Calendar className="w-5 h-5" />
                Book a Demo
              </Button>
              <span className="text-muted-foreground">or</span>
              <div className="flex items-center gap-2 bg-card border border-border rounded-lg p-1.5 shadow-lg">
                <Input 
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-64 border-0 focus-visible:ring-0 bg-transparent"
                />
                <Button 
                  className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1"
                  onClick={handleTrialRequest}
                >
                  Start Free Trial
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
            
            {/* Trust Signals */}
            <motion.div 
              variants={fadeIn}
              className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground"
            >
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-accent" />
                14-day free trial
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-accent" />
                No credit card required
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-accent" />
                Setup in under 5 minutes
              </span>
            </motion.div>
          </div>
          
          {/* Hero Stats */}
          <motion.div 
            variants={fadeIn}
            className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {[
              { stat: "30%", label: "Higher Revenue Growth", icon: TrendingUp },
              { stat: "4.2x", label: "More Likely to Outperform", icon: Rocket },
              { stat: "61%", label: "More Engaged Employees", icon: Heart },
              { stat: "50%", label: "Less Turnover", icon: Users },
            ].map((item, i) => (
              <div 
                key={i} 
                className="group bg-card rounded-2xl p-6 text-center border border-border hover:border-accent/50 hover:shadow-xl hover:shadow-accent/10 transition-all duration-300"
              >
                <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:bg-accent/20 transition-colors">
                  <item.icon className="w-6 h-6 text-accent" />
                </div>
                <div className="text-3xl sm:text-4xl font-black text-foreground mb-1">
                  {item.stat}
                </div>
                <div className="text-sm text-muted-foreground">{item.label}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* PROBLEM AGITATION SECTION */}
      <section id="why" className="py-24 px-4 sm:px-6 lg:px-8 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-accent/10 via-transparent to-transparent" />
        
        <div className="max-w-6xl mx-auto relative">
          <motion.div 
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeIn}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-destructive/20 text-destructive-foreground text-sm font-semibold mb-6 border border-destructive/30">
              <XCircle className="w-4 h-4" />
              The Brutal Truth
            </div>
            <h2 className="text-4xl sm:text-5xl font-black mb-6">
              Annual Reviews Are <span className="text-destructive">Killing</span> Your Business
            </h2>
            <p className="text-xl text-primary-foreground/80 max-w-3xl mx-auto">
              You're spending $2.4M per 10,000 employees on a process that actually 
              <span className="font-bold"> hurts performance</span> in 1/3 of cases.
            </p>
          </motion.div>
          
          <motion.div 
            className="grid md:grid-cols-3 gap-6"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {[
              {
                icon: DollarSign,
                stat: "$35M",
                title: "Wasted Per Year",
                description: "Large enterprises burn up to $35 million on reviews that don't improve performance.",
                substat: "per 10,000 employees"
              },
              {
                icon: Users,
                stat: "63%",
                title: "Leave for Growth",
                description: "Your best people quit because they don't see a path forward. No coaching = no loyalty.",
                substat: "cite lack of advancement"
              },
              {
                icon: Clock,
                stat: "95%",
                title: "Managers Hate It",
                description: "The process is so broken that nearly all managers dread doing reviews.",
                substat: "dissatisfied with process"
              }
            ].map((item, i) => (
              <motion.div 
                key={i} 
                variants={fadeIn}
                className="bg-primary-foreground/5 rounded-2xl p-8 border border-primary-foreground/10 backdrop-blur-sm"
              >
                <div className="w-14 h-14 rounded-2xl bg-destructive/20 flex items-center justify-center mb-6">
                  <item.icon className="w-7 h-7 text-destructive" />
                </div>
                <div className="text-4xl font-black text-destructive mb-1">{item.stat}</div>
                <div className="text-xs text-primary-foreground/60 mb-4">{item.substat}</div>
                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                <p className="text-primary-foreground/70">{item.description}</p>
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
            <div className="inline-block bg-accent/20 rounded-2xl px-8 py-6 border border-accent/30">
              <p className="text-2xl font-bold text-accent mb-2">
                "73% of Gen Z will leave if they don't get frequent feedback"
              </p>
              <p className="text-primary-foreground/60">— Gallup Workplace Report</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* SOLUTION SECTION */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/20 to-background" />
        
        <div className="max-w-6xl mx-auto relative">
          <motion.div 
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/20 text-accent-foreground text-sm font-semibold mb-6 border border-accent/30">
              <Sparkles className="w-4 h-4 text-accent" />
              The Jericho Way
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-foreground mb-6">
              AI Coaching That <span className="text-accent">Actually Works</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Replace outdated annual reviews with continuous AI-powered development 
              that employees love and managers can actually use.
            </p>
          </motion.div>
          
          {/* Feature Grid */}
          <motion.div 
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {[
              {
                icon: Brain,
                title: "AI Career Coach",
                description: "Every employee gets 24/7 access to Jericho, their personal AI coach. Guidance when they need it, not once a year.",
                highlight: "Always available"
              },
              {
                icon: Target,
                title: "Smart Capability Mapping",
                description: "AI analyzes roles and automatically creates personalized development paths. No more guessing what skills matter.",
                highlight: "Auto-generated plans"
              },
              {
                icon: TrendingUp,
                title: "Growth Roadmaps",
                description: "90-day sprints, 1-year goals, 3-year visions. Clear progress tracking that employees can actually see.",
                highlight: "Measurable progress"
              },
              {
                icon: BarChart3,
                title: "Manager Intelligence",
                description: "Real-time team analytics, capability gaps, and actionable insights. Lead with data, not gut feelings.",
                highlight: "Data-driven decisions"
              },
              {
                icon: MessageCircle,
                title: "Continuous 1:1s",
                description: "AI-assisted check-ins that matter. Employees with weekly 1:1s are 61% more engaged.",
                highlight: "Weekly touchpoints"
              },
              {
                icon: Award,
                title: "Built-in Recognition",
                description: "Celebrate wins as they happen. Engaged employees don't just perform—they stay and build.",
                highlight: "Real-time kudos"
              }
            ].map((feature, i) => (
              <motion.div key={i} variants={fadeIn}>
                <Card className="h-full group hover:shadow-2xl hover:shadow-accent/10 hover:border-accent/50 transition-all duration-500 bg-card/50 backdrop-blur-sm">
                  <CardContent className="p-8">
                    <div className="flex items-start justify-between mb-6">
                      <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 group-hover:scale-110 transition-all duration-300">
                        <feature.icon className="w-7 h-7 text-accent" />
                      </div>
                      <span className="text-xs font-semibold text-accent bg-accent/10 px-3 py-1 rounded-full">
                        {feature.highlight}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-3">{feature.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
          
          {/* Before/After */}
          <motion.div 
            className="grid md:grid-cols-2 gap-8"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            <motion.div variants={fadeIn}>
              <Card className="h-full bg-destructive/5 border-destructive/20">
                <CardContent className="p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-destructive/20 flex items-center justify-center">
                      <XCircle className="w-6 h-6 text-destructive" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-destructive">Before Jericho</h3>
                      <p className="text-sm text-muted-foreground">The old way of doing things</p>
                    </div>
                  </div>
                  <ul className="space-y-4">
                    {[
                      "One awkward conversation per year",
                      "Managers scramble to remember details",
                      "Employees blindsided by feedback",
                      "No real-time course correction",
                      "Goals set once, forgotten quickly",
                      "Best talent leaves for growth elsewhere"
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
              <Card className="h-full bg-accent/5 border-accent/30 shadow-xl shadow-accent/10">
                <CardContent className="p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-accent">After Jericho</h3>
                      <p className="text-sm text-muted-foreground">The continuous growth model</p>
                    </div>
                  </div>
                  <ul className="space-y-4">
                    {[
                      "Ongoing AI coaching conversations",
                      "Evidence-based, bias-free feedback",
                      "Employees always know where they stand",
                      "Real-time development adjustments",
                      "Goals adapt quarter by quarter",
                      "Top performers stay and grow"
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
        </div>
      </section>

      {/* SOCIAL PROOF SECTION */}
      <section id="proof" className="py-24 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
          >
            <h2 className="text-4xl sm:text-5xl font-black text-foreground mb-6">
              Leaders Trust <span className="text-accent">Jericho</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Join forward-thinking companies that prioritize continuous growth over outdated processes.
            </p>
          </motion.div>
          
          {/* Testimonials */}
          <motion.div 
            className="grid md:grid-cols-3 gap-8 mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {[
              {
                quote: "We saw employee engagement jump 40% in the first quarter. Jericho transformed how our managers develop their teams.",
                author: "Sarah Chen",
                role: "VP of People, TechCorp",
                rating: 5
              },
              {
                quote: "Finally, a development platform that employees actually want to use. Our retention rates have never been better.",
                author: "Michael Torres",
                role: "CHRO, Growth Dynamics",
                rating: 5
              },
              {
                quote: "The AI coaching is incredible. It's like giving every employee access to an executive coach 24/7.",
                author: "Jennifer Walsh",
                role: "L&D Director, Innovate Inc",
                rating: 5
              }
            ].map((testimonial, i) => (
              <motion.div key={i} variants={fadeIn}>
                <Card className="h-full bg-card hover:shadow-xl transition-all duration-300">
                  <CardContent className="p-8">
                    <div className="flex items-center gap-1 mb-4">
                      {[...Array(testimonial.rating)].map((_, j) => (
                        <Star key={j} className="w-5 h-5 fill-accent text-accent" />
                      ))}
                    </div>
                    <Quote className="w-10 h-10 text-accent/20 mb-4" />
                    <p className="text-foreground mb-6 leading-relaxed italic">
                      "{testimonial.quote}"
                    </p>
                    <div>
                      <p className="font-bold text-foreground">{testimonial.author}</p>
                      <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
          
          {/* Results Stats */}
          <motion.div 
            className="bg-primary rounded-3xl p-12 text-primary-foreground"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={scaleIn}
          >
            <div className="text-center mb-10">
              <h3 className="text-3xl font-bold mb-2">Real Results. Real Companies.</h3>
              <p className="text-primary-foreground/70">Average outcomes from Jericho customers</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { stat: "40%", label: "Increase in Engagement" },
                { stat: "35%", label: "Reduction in Turnover" },
                { stat: "3x", label: "Faster Skill Development" },
                { stat: "90%", label: "Manager Satisfaction" }
              ].map((result, i) => (
                <div key={i} className="text-center">
                  <div className="text-5xl font-black text-accent mb-2">{result.stat}</div>
                  <div className="text-primary-foreground/80">{result.label}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* PRICING SECTION */}
      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
          >
            <h2 className="text-4xl sm:text-5xl font-black text-foreground mb-6">
              Simple, Transparent <span className="text-accent">Pricing</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Start free. Scale as you grow. No hidden fees, no surprises.
            </p>
          </motion.div>
          
          <motion.div 
            className="grid md:grid-cols-2 gap-8"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {/* Starter Plan */}
            <motion.div variants={fadeIn}>
              <Card className="h-full border-2 hover:shadow-xl transition-all duration-300">
                <CardContent className="p-8">
                  <div className="mb-6">
                    <h3 className="text-2xl font-bold text-foreground mb-2">Starter</h3>
                    <p className="text-muted-foreground">Perfect for growing teams</p>
                  </div>
                  <div className="mb-8">
                    <span className="text-5xl font-black text-foreground">$12</span>
                    <span className="text-muted-foreground">/user/month</span>
                  </div>
                  <ul className="space-y-4 mb-8">
                    {[
                      "AI Career Coach (Jericho)",
                      "Capability mapping & development paths",
                      "90-day goal tracking",
                      "1:1 meeting support",
                      "Basic analytics",
                      "Email support"
                    ].map((feature, i) => (
                      <li key={i} className="flex items-center gap-3 text-foreground">
                        <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button 
                    className="w-full h-12 text-lg" 
                    variant="outline"
                    onClick={() => {
                      setEmail("");
                      document.querySelector<HTMLInputElement>('input[type="email"]')?.focus();
                    }}
                  >
                    Start Free Trial
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
            
            {/* Pro Plan */}
            <motion.div variants={fadeIn}>
              <Card className="h-full border-2 border-accent bg-accent/5 shadow-xl shadow-accent/20 relative overflow-hidden">
                <div className="absolute top-4 right-4 bg-accent text-accent-foreground text-xs font-bold px-3 py-1 rounded-full">
                  MOST POPULAR
                </div>
                <CardContent className="p-8">
                  <div className="mb-6">
                    <h3 className="text-2xl font-bold text-foreground mb-2">Enterprise</h3>
                    <p className="text-muted-foreground">For organizations ready to scale</p>
                  </div>
                  <div className="mb-8">
                    <span className="text-5xl font-black text-foreground">Custom</span>
                  </div>
                  <ul className="space-y-4 mb-8">
                    {[
                      "Everything in Starter, plus:",
                      "Advanced team analytics & insights",
                      "Strategic learning design",
                      "Custom capability frameworks",
                      "SSO & advanced security",
                      "Dedicated success manager",
                      "API access & integrations",
                      "Onboarding & training"
                    ].map((feature, i) => (
                      <li key={i} className="flex items-center gap-3 text-foreground">
                        <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button 
                    className="w-full h-12 text-lg bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg shadow-accent/30"
                    onClick={handleDemoRequest}
                  >
                    Book a Demo
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* FINAL CTA SECTION */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-accent/20 via-transparent to-transparent" />
        
        <motion.div 
          className="max-w-4xl mx-auto text-center relative"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeIn}
        >
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black mb-6">
            Ready to Transform Your<br />
            <span className="text-accent">People Development?</span>
          </h2>
          <p className="text-xl text-primary-foreground/80 mb-10 max-w-2xl mx-auto">
            Join the companies that have already made the switch from outdated reviews 
            to continuous AI-powered growth. Your team is waiting.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Button 
              size="lg" 
              className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2 text-lg px-10 h-14 shadow-xl shadow-accent/30 font-semibold"
              onClick={handleDemoRequest}
            >
              <Calendar className="w-5 h-5" />
              Book Your Demo Now
            </Button>
            <Link to="/auth">
              <Button 
                size="lg" 
                variant="outline"
                className="gap-2 text-lg px-10 h-14 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
              >
                Start Free Trial
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-primary-foreground/70">
            <span className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              SOC 2 Compliant
            </span>
            <span className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              5-minute setup
            </span>
            <span className="flex items-center gap-2">
              <Heart className="w-4 h-4" />
              Loved by 10,000+ employees
            </span>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-card border-t border-border">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-accent-foreground" />
              </div>
              <span className="text-lg font-bold text-foreground">Jericho</span>
              <span className="text-xs text-muted-foreground">by The Momentum Company</span>
            </div>
            <div className="flex items-center gap-8 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="#" className="hover:text-foreground transition-colors">Terms</a>
              <a href="#" className="hover:text-foreground transition-colors">Contact</a>
              <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 The Momentum Company. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Sales;
