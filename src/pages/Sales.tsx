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
  Calendar,
  Zap,
  BarChart3,
  Heart,
  Shield,
  Star,
  Quote,
  Brain,
  Rocket,
  Award,
  Clock,
  AlertTriangle,
  Headphones,
  LineChart,
  UserCheck,
  FileText,
  Eye,
  RefreshCw
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
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5 } }
};

const Sales = () => {
  const [email, setEmail] = useState("");

  const handleDemoRequest = () => {
    window.open("https://calendly.com/jericho-demo", "_blank");
  };

  const handleTrialRequest = () => {
    if (email) {
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
              <a href="#problem" className="text-sm text-muted-foreground hover:text-foreground transition-colors">The Problem</a>
              <a href="#solution" className="text-sm text-muted-foreground hover:text-foreground transition-colors">The Solution</a>
              <a href="#who" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Who It's For</a>
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

      {/* HERO SECTION */}
      <section className="pt-28 pb-20 px-4 sm:px-6 lg:px-8 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-destructive/5 via-transparent to-transparent" />
        <div className="absolute top-32 -right-32 w-[500px] h-[500px] bg-accent/15 rounded-full blur-[120px]" />
        <div className="absolute top-64 -left-32 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px]" />
        
        <motion.div 
          className="max-w-5xl mx-auto relative"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          <div className="text-center">
            <motion.div 
              variants={fadeIn}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-destructive/10 text-destructive text-sm font-semibold mb-8 border border-destructive/20"
            >
              <AlertTriangle className="w-4 h-4" />
              Let's be honest.
            </motion.div>
            
            <motion.h1 
              variants={fadeIn}
              className="text-5xl sm:text-6xl lg:text-7xl font-black text-foreground mb-8 leading-[1.1] tracking-tight"
            >
              Performance Reviews<br />
              <span className="text-destructive">Are Broken.</span>
            </motion.h1>
            
            <motion.div 
              variants={fadeIn}
              className="max-w-3xl mx-auto mb-10"
            >
              <p className="text-xl sm:text-2xl text-muted-foreground leading-relaxed mb-6">
                Your performance reviews don't manage performance.<br />
                <span className="text-foreground font-medium">They document it… badly… long after it mattered.</span>
              </p>
              <p className="text-lg text-muted-foreground">
                Once a year, managers scramble to remember what actually happened.
                Employees brace for surprises.
                HR chases forms, deadlines, and compliance.
              </p>
            </motion.div>
            
            <motion.div 
              variants={fadeIn}
              className="bg-card border border-border rounded-2xl p-8 max-w-2xl mx-auto mb-10"
            >
              <p className="text-lg text-muted-foreground mb-4">And when it's finally over?</p>
              <p className="text-3xl font-bold text-foreground mb-4">Nothing changes.</p>
              <p className="text-muted-foreground">Until next year.</p>
            </motion.div>
            
            <motion.div 
              variants={fadeIn}
              className="bg-primary/5 border border-primary/20 rounded-2xl p-6 max-w-xl mx-auto mb-12"
            >
              <p className="text-lg text-foreground italic">
                "Am I growing here… or just aging in place?"
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                — What your best people quietly wonder before they leave
              </p>
            </motion.div>
            
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
        </motion.div>
      </section>

      {/* THE REAL COST SECTION */}
      <section id="problem" className="py-24 px-4 sm:px-6 lg:px-8 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-destructive/20 via-transparent to-transparent" />
        
        <div className="max-w-5xl mx-auto relative">
          <motion.div 
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeIn}
          >
            <h2 className="text-4xl sm:text-5xl font-black mb-6">
              The Real Cost of <span className="text-destructive">Broken</span> Performance Management
            </h2>
            <p className="text-xl text-primary-foreground/80 max-w-3xl mx-auto">
              This isn't about process. <span className="font-bold">It's about drift.</span>
            </p>
          </motion.div>
          
          <motion.div 
            className="mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
          >
            <h3 className="text-2xl font-bold text-center mb-8 text-primary-foreground/90">When feedback is rare:</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { icon: AlertTriangle, text: "Performance issues fester instead of getting fixed" },
                { icon: Clock, text: "Growth conversations get postponed… indefinitely" },
                { icon: Eye, text: "High performers feel unseen" },
                { icon: XCircle, text: "Managers default to avoidance" },
                { icon: TrendingUp, text: "Engagement erodes quietly" },
                { icon: Users, text: "Turnover shows up later and feels \"unexpected\"" }
              ].map((item, i) => (
                <div 
                  key={i}
                  className="flex items-start gap-3 bg-primary-foreground/5 rounded-xl p-5 border border-primary-foreground/10"
                >
                  <item.icon className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <span className="text-primary-foreground/90">{item.text}</span>
                </div>
              ))}
            </div>
          </motion.div>
          
          <motion.div 
            className="text-center space-y-6"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
          >
            <div className="bg-primary-foreground/10 rounded-2xl p-8 max-w-3xl mx-auto">
              <p className="text-2xl font-bold mb-4">
                Annual reviews don't fail loudly.
              </p>
              <p className="text-xl text-primary-foreground/80">
                They fail slowly… and <span className="text-destructive font-bold">expensively.</span>
              </p>
            </div>
            
            <div className="bg-accent/20 rounded-2xl p-8 max-w-3xl mx-auto border border-accent/30">
              <p className="text-xl text-primary-foreground">
                Most companies don't lose talent because of <span className="line-through opacity-60">pay</span>.
              </p>
              <p className="text-2xl font-bold text-accent mt-2">
                They lose talent because people don't see a future.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* THE SOLUTION SECTION */}
      <section id="solution" className="py-24 px-4 sm:px-6 lg:px-8 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-accent/5 to-background" />
        
        <div className="max-w-5xl mx-auto relative">
          <motion.div 
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/20 text-accent-foreground text-sm font-semibold mb-6 border border-accent/30">
              <Sparkles className="w-4 h-4 text-accent" />
              What if performance management actually managed performance?
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-foreground mb-6">
              Jericho Fixes What<br />
              <span className="text-accent">Everyone Else Avoids</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-4">
              Jericho replaces the annual review theater with something radically more effective:
            </p>
            <p className="text-2xl font-bold text-foreground">
              Continuous, personalized, AI-powered coaching—embedded into daily work.
            </p>
          </motion.div>
          
          {/* Three Pillars */}
          <motion.div 
            className="grid md:grid-cols-3 gap-6 mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {[
              { word: "No forms.", icon: FileText },
              { word: "No memory games.", icon: Brain },
              { word: "No awkward once-a-year conversations.", icon: MessageCircle }
            ].map((item, i) => (
              <motion.div 
                key={i} 
                variants={fadeIn}
                className="bg-card border border-border rounded-2xl p-8 text-center hover:shadow-xl hover:border-accent/50 transition-all duration-300"
              >
                <div className="w-16 h-16 bg-destructive/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <item.icon className="w-8 h-8 text-destructive" />
                </div>
                <p className="text-xl font-bold text-foreground">{item.word}</p>
              </motion.div>
            ))}
          </motion.div>
          
          <motion.div 
            className="text-center mb-20"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
          >
            <div className="inline-flex items-center gap-4 bg-accent/10 border border-accent/30 rounded-2xl px-8 py-6">
              <span className="text-2xl font-bold text-foreground">Just clarity.</span>
              <span className="text-2xl font-bold text-accent">Momentum.</span>
              <span className="text-2xl font-bold text-foreground">Progress.</span>
            </div>
          </motion.div>
          
          {/* What Jericho Does */}
          <motion.div 
            className="mb-20"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
          >
            <div className="text-center mb-12">
              <h3 className="text-3xl font-bold text-foreground mb-4">
                What Jericho Does <span className="text-muted-foreground">(In Plain English)</span>
              </h3>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Jericho acts like a quiet, always-on coach inside your organization.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-4 mb-8">
              {[
                { text: "Not replacing managers.", icon: UserCheck },
                { text: "Not spying on employees.", icon: Eye },
                { text: "Not adding more work.", icon: Clock }
              ].map((item, i) => (
                <div 
                  key={i}
                  className="flex items-center gap-3 bg-muted/30 rounded-xl p-4"
                >
                  <item.icon className="w-5 h-5 text-accent shrink-0" />
                  <span className="text-foreground">{item.text}</span>
                </div>
              ))}
            </div>
            
            <p className="text-center text-xl font-medium text-foreground">
              It does the heavy lifting everyone keeps avoiding.
            </p>
          </motion.div>
          
          {/* Feature Cards */}
          <motion.div 
            className="grid md:grid-cols-2 gap-8"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {/* No More Surprise Feedback */}
            <motion.div variants={fadeIn}>
              <Card className="h-full bg-card hover:shadow-xl transition-all duration-300 group">
                <CardContent className="p-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                      <MessageCircle className="w-7 h-7 text-accent" />
                    </div>
                    <h4 className="text-xl font-bold text-foreground">No More Surprise Feedback</h4>
                  </div>
                  <p className="text-muted-foreground mb-6">
                    Employees don't wait months to find out how they're doing.
                  </p>
                  <p className="text-sm font-semibold text-accent mb-4">Jericho delivers:</p>
                  <ul className="space-y-3">
                    {[
                      "Daily micro-coaching through personalized audio and chat",
                      "Real-time nudges tied to the skills each person is building",
                      "Ongoing clarity about expectations and progress"
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-foreground">
                        <CheckCircle2 className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6 pt-6 border-t border-border">
                    <p className="text-foreground font-medium">Feedback becomes <span className="text-accent">normal</span>.</p>
                    <p className="text-muted-foreground">Not emotional. Not scary.</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            
            {/* No More Forgotten Wins */}
            <motion.div variants={fadeIn}>
              <Card className="h-full bg-card hover:shadow-xl transition-all duration-300 group">
                <CardContent className="p-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                      <Award className="w-7 h-7 text-accent" />
                    </div>
                    <h4 className="text-xl font-bold text-foreground">No More Forgotten Wins</h4>
                  </div>
                  <p className="text-muted-foreground mb-6">
                    Jericho remembers everything humans forget.
                  </p>
                  <div className="grid grid-cols-2 gap-2 mb-6">
                    {["Goals", "1:1 conversations", "Coaching moments", "Recognition", "Progress over time"].map((item, i) => (
                      <div key={i} className="bg-muted/30 rounded-lg px-3 py-2 text-sm text-foreground">
                        {item}
                      </div>
                    ))}
                  </div>
                  <p className="text-foreground mb-4">
                    When review time does come, <span className="font-medium">the story is already written—accurately.</span>
                  </p>
                  <div className="space-y-1 text-muted-foreground">
                    <p>No rewriting history.</p>
                    <p>No recency bias.</p>
                    <p>No "I swear I did more than that."</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            
            {/* No More Vague Development Plans */}
            <motion.div variants={fadeIn} className="md:col-span-2">
              <Card className="bg-accent/5 border-accent/30 hover:shadow-xl transition-all duration-300">
                <CardContent className="p-8">
                  <div className="grid md:grid-cols-2 gap-8">
                    <div>
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-14 h-14 bg-accent/20 rounded-2xl flex items-center justify-center">
                          <Target className="w-7 h-7 text-accent" />
                        </div>
                        <h4 className="text-xl font-bold text-foreground">No More Vague Development Plans</h4>
                      </div>
                      <p className="text-lg text-foreground mb-4">
                        <span className="line-through text-muted-foreground">"Work on leadership"</span> is not a plan.
                      </p>
                      <p className="text-muted-foreground">
                        Jericho identifies actual capability gaps, where each employee is stuck, 
                        and what skill unlocks the next level.
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-accent mb-4">Then it automatically matches:</p>
                      <ul className="space-y-3 mb-6">
                        {[
                          "Learning resources",
                          "Coaching prompts",
                          "Stretch opportunities"
                        ].map((item, i) => (
                          <li key={i} className="flex items-center gap-3 text-foreground">
                            <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                      <div className="bg-accent/10 rounded-xl p-4">
                        <p className="text-lg font-bold text-foreground">
                          Growth stops being theoretical.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* WHO IT'S FOR SECTION */}
      <section id="who" className="py-24 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
          >
            <h2 className="text-4xl sm:text-5xl font-black text-foreground mb-4">
              Built for <span className="text-accent">Everyone</span> Who's Tired of the Status Quo
            </h2>
          </motion.div>
          
          <motion.div 
            className="grid lg:grid-cols-3 gap-8"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {/* For Managers */}
            <motion.div variants={fadeIn}>
              <Card className="h-full bg-card hover:shadow-xl transition-all duration-300">
                <CardContent className="p-8">
                  <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
                    <UserCheck className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-4">For Managers</h3>
                  <p className="text-xl font-medium text-accent mb-6">Relief You Can Feel</p>
                  <p className="text-muted-foreground mb-6">
                    Managers are drowning—not because they don't care, but because they're overloaded.
                  </p>
                  
                  <div className="space-y-6">
                    <div>
                      <p className="text-sm font-semibold text-destructive mb-3">Old Way:</p>
                      <ul className="space-y-2">
                        {[
                          "Writing reviews from memory",
                          "Avoiding tough conversations",
                          "Feeling guilty for \"not developing people\"",
                          "Performance management as admin work"
                        ].map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div>
                      <p className="text-sm font-semibold text-accent mb-3">Jericho Way:</p>
                      <ul className="space-y-2">
                        {[
                          "Auto-generated review drafts grounded in real data",
                          "Coaching handled continuously—not all at once",
                          "Clear talking points for real conversations",
                          "An AI coach working 24/7 alongside you"
                        ].map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                            <CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  
                  <div className="mt-6 pt-6 border-t border-border">
                    <p className="text-foreground italic">
                      You don't become a better manager by trying harder.
                      <span className="font-medium text-accent"> You become better when the system finally helps you.</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            
            {/* For Employees */}
            <motion.div variants={fadeIn}>
              <Card className="h-full bg-card hover:shadow-xl transition-all duration-300">
                <CardContent className="p-8">
                  <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center mb-6">
                    <Rocket className="w-7 h-7 text-accent" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-4">For Employees</h3>
                  <p className="text-xl font-medium text-accent mb-6">Growth That's Obvious</p>
                  <p className="text-muted-foreground mb-6">
                    With Jericho, employees don't guess where they stand.
                  </p>
                  
                  <p className="text-sm font-semibold text-accent mb-3">They:</p>
                  <ul className="space-y-3 mb-6">
                    {[
                      "Wake up to short, personalized podcast episodes on the skill they're building",
                      "Chat anytime about goals, blockers, or next steps",
                      "See exactly what progress looks like—and what's next"
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-foreground">
                        <CheckCircle2 className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  
                  <div className="bg-muted/50 rounded-xl p-4 mb-6">
                    <p className="text-sm text-muted-foreground mb-2">No more wondering:</p>
                    <ul className="space-y-1 text-sm text-foreground italic">
                      <li>"Am I doing well here?"</li>
                      <li>"Am I falling behind?"</li>
                      <li>"Does anyone even notice?"</li>
                    </ul>
                  </div>
                  
                  <div className="bg-accent/10 rounded-xl p-4">
                    <p className="text-lg font-bold text-foreground">
                      Clarity replaces anxiety.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            
            {/* For HR */}
            <motion.div variants={fadeIn}>
              <Card className="h-full bg-card hover:shadow-xl transition-all duration-300">
                <CardContent className="p-8">
                  <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
                    <LineChart className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-4">For HR</h3>
                  <p className="text-xl font-medium text-accent mb-6">Data That Actually Means Something</p>
                  <p className="text-muted-foreground mb-6">
                    Jericho turns performance management from paperwork into insight.
                  </p>
                  
                  <p className="text-sm font-semibold text-accent mb-3">You get:</p>
                  <ul className="space-y-3 mb-6">
                    {[
                      "Real-time capability heatmaps across the organization",
                      "Early signals on burnout and flight risk",
                      "Proof of ROI on development spend",
                      "Trends you can act on—not lagging indicators"
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-foreground">
                        <CheckCircle2 className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  
                  <div className="bg-accent/10 rounded-xl p-4">
                    <p className="text-lg font-bold text-foreground">
                      Finally, HR moves from chasing compliance to shaping outcomes.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* NOT ANOTHER TOOL SECTION */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-accent/10 via-transparent to-transparent" />
        
        <motion.div 
          className="max-w-4xl mx-auto text-center relative"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeIn}
        >
          <h2 className="text-4xl sm:text-5xl font-black mb-8">
            This Isn't Another <span className="text-accent">HR Tool</span>
          </h2>
          <p className="text-xl text-primary-foreground/90 mb-8">
            Jericho isn't software you "roll out."
            <br /><span className="font-bold text-accent">It's infrastructure you build on.</span>
          </p>
          <p className="text-lg text-primary-foreground/80 mb-12 max-w-3xl mx-auto">
            It meets people where they already are—in their day, in their work, in their reality.
          </p>
          
          <div className="grid sm:grid-cols-3 gap-6 mb-12">
            {[
              "No dashboards nobody opens.",
              "No quarterly initiatives that fade.",
              "No motivational posters pretending things are fine."
            ].map((item, i) => (
              <div key={i} className="bg-primary-foreground/10 rounded-xl p-6 border border-primary-foreground/20">
                <XCircle className="w-8 h-8 text-destructive mx-auto mb-3" />
                <p className="text-primary-foreground">{item}</p>
              </div>
            ))}
          </div>
          
          <div className="bg-accent/20 rounded-2xl p-8 border border-accent/30">
            <p className="text-2xl font-bold text-accent">
              Just steady, compounding progress.
            </p>
          </div>
        </motion.div>
      </section>

      {/* ONE LAST TRUTH SECTION */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <motion.div 
          className="max-w-4xl mx-auto text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeIn}
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-8">
            One Last Truth
          </h2>
          <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-8 mb-8">
            <p className="text-xl text-foreground mb-4">
              If your people only get feedback once a year…
            </p>
            <p className="text-2xl font-bold text-destructive">
              You're not managing performance.
            </p>
            <p className="text-lg text-muted-foreground mt-4">
              You're managing risk—and hoping for the best.
            </p>
          </div>
          
          <p className="text-xl text-foreground mb-8">
            Jericho exists for leaders who are <span className="font-bold">done hoping.</span>
          </p>
          
          <div className="flex items-center justify-center gap-6 text-lg text-muted-foreground mb-8">
            <span>Not louder.</span>
            <span>Not flashier.</span>
            <span className="text-foreground font-bold">Just fundamentally better.</span>
          </div>
        </motion.div>
      </section>

      {/* PRICING SECTION */}
      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 bg-muted/30">
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
              Start free. Scale as you grow. No hidden fees.
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
                    <span className="text-5xl font-black text-foreground">$75</span>
                    <span className="text-muted-foreground">/user/month</span>
                  </div>
                  <ul className="space-y-4 mb-8">
                    {[
                      "AI Career Coach (Jericho)",
                      "Personalized daily podcasts",
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
                  <Link to="/auth">
                    <Button className="w-full h-12 text-lg" variant="outline">
                      Start Free Trial
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
            
            {/* Enterprise Plan */}
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
                      "Real-time capability heatmaps",
                      "Burnout & flight risk signals",
                      "Strategic learning design",
                      "Custom capability frameworks",
                      "SSO & advanced security",
                      "Dedicated success manager",
                      "API access & integrations"
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
          <div className="w-20 h-20 bg-accent rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-accent/30">
            <Sparkles className="w-10 h-10 text-accent-foreground" />
          </div>
          
          <h2 className="text-3xl sm:text-4xl font-black mb-4">
            Jericho
          </h2>
          <p className="text-xl text-primary-foreground/80 mb-10">
            Performance management that feels less like paperwork…<br />
            <span className="text-accent font-bold">and more like progress.</span>
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
