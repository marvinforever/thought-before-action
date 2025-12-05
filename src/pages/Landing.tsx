import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Target, 
  Bot, 
  TrendingUp, 
  Users, 
  BookOpen, 
  Trophy,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  BarChart3,
  Zap
} from "lucide-react";

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
              <a href="#features" className="text-sm text-muted-foreground hover:text-accent transition-colors">Features</a>
              <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-accent transition-colors">How It Works</a>
              <Link to="/academy" className="text-sm text-muted-foreground hover:text-accent transition-colors">Academy</Link>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-foreground">Text <span className="text-accent font-bold">"Jericho"</span> to <span className="font-bold">402.881.9986</span></span>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-primary/5" />
        <div className="absolute top-20 right-10 w-72 h-72 bg-accent/20 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        <div className="max-w-7xl mx-auto relative">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/20 text-accent-foreground text-sm font-medium mb-6 border border-accent/30">
              <Zap className="w-4 h-4 text-accent" />
              AI-Powered Performance Management
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
              Hyper-Personalized Growth for{" "}
              <span className="text-accent">Every Employee</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Transform capability gaps into career momentum with AI-driven assessments, 
              tailored roadmaps, and your personal AI career coach.
            </p>
            <div className="flex flex-col items-center gap-2">
              <p className="text-lg font-medium text-foreground">
                Text <span className="text-accent font-bold">"Jericho"</span> to
              </p>
              <a href="sms:4028819986?body=Jericho" className="text-3xl font-bold text-accent hover:underline">
                402.881.9986
              </a>
            </div>
          </div>
          
          {/* Hero Visual */}
          <div className="mt-16 relative">
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10" />
            <div className="bg-gradient-to-br from-primary/20 to-accent/30 rounded-2xl p-8 backdrop-blur-sm border border-accent/30">
              <div className="grid grid-cols-3 gap-4">
                {["Leadership", "Communication", "Strategic Thinking"].map((cap, i) => (
                  <div key={i} className="bg-background/80 rounded-xl p-4 border border-border/50">
                    <div className="text-sm font-medium text-foreground mb-2">{cap}</div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-accent rounded-full transition-all duration-1000"
                        style={{ width: `${60 + i * 15}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Level {2 + i} → {3 + i}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem/Solution Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              The Future of Employee Development
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Traditional training fails because it's generic. Jericho succeeds because it's personal.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="bg-destructive/5 border-destructive/20">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold text-destructive mb-4">The Old Way</h3>
                <ul className="space-y-3">
                  {[
                    "One-size-fits-all training programs",
                    "Annual reviews that feel disconnected",
                    "Employees feel stuck without clear growth paths",
                    "Managers lack visibility into team development"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-muted-foreground">
                      <span className="text-destructive mt-1">✕</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            
            <Card className="bg-accent/10 border-accent/30">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold text-accent mb-4">The Jericho Way</h3>
                <ul className="space-y-3">
                  {[
                    "AI-driven capability assessments for each role",
                    "Continuous coaching from your personal AI mentor",
                    "Clear 90-day, 1-year, and 3-year growth roadmaps",
                    "Real-time team analytics and development insights"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-foreground">
                      <CheckCircle2 className="w-5 h-5 text-accent mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Everything You Need to <span className="text-accent">Grow</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Comprehensive tools for employees, managers, and organizations to drive meaningful development.
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Target,
                title: "Capability Mapping",
                description: "AI analyzes job descriptions to identify required skills and create personalized development paths."
              },
              {
                icon: Bot,
                title: "Meet Jericho",
                description: "Your personal AI career coach, available 24/7 to guide your professional growth journey."
              },
              {
                icon: TrendingUp,
                title: "Growth Roadmaps",
                description: "Clear 90-day sprints, 1-year milestones, and 3-year visions tailored to your goals."
              },
              {
                icon: Users,
                title: "Manager Insights",
                description: "Team analytics, capability gaps, and actionable recommendations for leaders."
              },
              {
                icon: BookOpen,
                title: "Curated Resources",
                description: "Books, videos, podcasts, and courses matched precisely to your capability gaps."
              },
              {
                icon: Trophy,
                title: "Recognition & Goals",
                description: "Track achievements, celebrate progress, and maintain momentum in your growth."
              }
            ].map((feature, i) => (
              <Card key={i} className="group hover:shadow-lg transition-all duration-300 hover:border-accent/50 hover:shadow-accent/10">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center mb-4 group-hover:bg-accent/30 transition-colors">
                    <feature.icon className="w-6 h-6 text-accent" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              How It Works
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Get started in minutes and begin your personalized growth journey today.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Assess",
                description: "Complete your capability self-assessment with Jericho's conversational guidance. Understand where you are and where you want to go."
              },
              {
                step: "02",
                title: "Plan",
                description: "Receive your personalized growth roadmap based on your role, goals, and aspirations. Clear milestones from 90 days to 3 years."
              },
              {
                step: "03",
                title: "Grow",
                description: "Get daily micro-training, curated resources, and AI coaching to build momentum and accelerate your development."
              }
            ].map((item, i) => (
              <div key={i} className="relative">
                <div className="text-6xl font-bold text-accent/30 mb-4">{item.step}</div>
                <h3 className="text-xl font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
                {i < 2 && (
                  <ArrowRight className="hidden md:block absolute top-8 -right-4 w-8 h-8 text-accent/50" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For Organizations */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                For Forward-Thinking <span className="text-accent">Organizations</span>
              </h2>
              <p className="text-lg text-muted-foreground mb-6">
                See your entire organization's capability landscape at a glance. 
                Make data-driven decisions about talent development and strategic learning investments.
              </p>
              <ul className="space-y-4">
                {[
                  "Strategic Learning Design reports",
                  "Team capability analytics and gap analysis",
                  "ROI tracking on development initiatives",
                  "Customizable capability frameworks"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center">
                      <BarChart3 className="w-4 h-4 text-accent" />
                    </div>
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-gradient-to-br from-primary/10 to-accent/20 rounded-2xl p-8 border border-accent/30">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Organization Capability Score</span>
                  <span className="text-2xl font-bold text-accent">78%</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-accent rounded-full w-[78%]" />
                </div>
                <div className="grid grid-cols-2 gap-4 mt-6">
                  {[
                    { label: "Employees", value: "247" },
                    { label: "Capabilities Tracked", value: "42" },
                    { label: "Avg Growth Rate", value: "+12%" },
                    { label: "Goals Completed", value: "89%" }
                  ].map((stat, i) => (
                    <div key={i} className="bg-background/50 rounded-lg p-3 border border-accent/10">
                      <div className="text-xs text-muted-foreground">{stat.label}</div>
                      <div className="text-lg font-semibold text-foreground">{stat.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-accent">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-accent-foreground mb-4">
            Ready to Accelerate Your Growth?
          </h2>
          <p className="text-xl text-accent-foreground/80 mb-8">
            Join forward-thinking organizations using Jericho to transform employee development.
          </p>
          <div className="flex flex-col items-center gap-2">
            <p className="text-lg font-medium text-accent-foreground">
              Text <span className="font-bold">"Jericho"</span> to
            </p>
            <a href="sms:4028819986?body=Jericho" className="text-3xl font-bold text-accent-foreground hover:underline">
              402.881.9986
            </a>
          </div>
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
        </div>
      </footer>
    </div>
  );
};

export default Landing;
