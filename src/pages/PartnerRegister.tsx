import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { 
  Sparkles, 
  CheckCircle2, 
  DollarSign, 
  Users, 
  TrendingUp,
  ArrowRight,
  Handshake,
  Target,
  Gift
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

export default function PartnerRegister() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const generateReferralCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Sign out any existing session first
      await supabase.auth.signOut();

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
          emailRedirectTo: `${window.location.origin}/partner`
        }
      });

      if (authError) {
        // If the email already exists, log them in and enroll them as a partner instead.
        if (authError.message.toLowerCase().includes("already")) {
          const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (signInErr) throw signInErr;
          if (!signInData.user) throw new Error("Unable to sign in.");

          const { data: existingPartner, error: existingErr } = await supabase
            .from("referral_partners")
            .select("id")
            .eq("user_id", signInData.user.id)
            .maybeSingle();

          if (existingErr) throw existingErr;

          if (!existingPartner) {
            const referralCode = generateReferralCode();
            const { error: enrollErr } = await supabase.from("referral_partners").insert({
              user_id: signInData.user.id,
              name,
              email,
              phone: phone || null,
              company: company || null,
              referral_code: referralCode,
            });
            if (enrollErr) throw enrollErr;

            await supabase.from("user_roles").upsert(
              { user_id: signInData.user.id, role: "partner" },
              { onConflict: "user_id,role" }
            );
          }

          toast({
            title: "You're in!",
            description: "We found your account and enrolled you as a partner.",
          });
          navigate("/partner");
          return;
        }

        throw authError;
      }
      if (!authData.user) throw new Error("Failed to create account");

      const referralCode = generateReferralCode();
      const { error: partnerError } = await supabase
        .from('referral_partners')
        .insert({
          user_id: authData.user.id,
          name,
          email,
          phone: phone || null,
          company: company || null,
          referral_code: referralCode,
        });

      if (partnerError) throw partnerError;

      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role: 'partner'
        });

      if (roleError) throw roleError;

      toast({
        title: "Welcome to the Partner Program!",
        description: "Your account has been created. Redirecting to your dashboard...",
      });

      navigate('/partner');
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
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
              <span className="hidden sm:block text-[10px] text-primary-foreground/70 -mt-1">Partner Program</span>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/partner/login">
              <Button variant="ghost" className="text-accent hover:text-accent hover:bg-accent/10">Partner Login</Button>
            </Link>
            <Link to="/">
              <Button variant="outline" className="border-accent text-accent hover:bg-accent/10">
                Back to Jericho
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
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
              <Handshake className="w-4 h-4 text-accent" />
              <span className="text-accent font-medium text-sm">Partner Program</span>
            </motion.div>
            
            <motion.h1 
              variants={fadeIn}
              className="text-4xl md:text-6xl font-bold leading-tight text-primary-foreground"
            >
              Help Leaders Grow.<br />
              <span className="text-accent">Get Rewarded.</span>
            </motion.h1>
            
            <motion.p 
              variants={fadeIn}
              className="text-xl md:text-2xl text-primary-foreground/80 max-w-3xl mx-auto leading-relaxed"
            >
              Join our partner program and earn <span className="text-accent font-semibold">10% commission</span> on every organization you refer to Jericho. Simple. Transparent. Lucrative.
            </motion.p>
          </motion.div>
        </div>
        
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-highlight-gold" style={{ clipPath: 'polygon(0 100%, 100% 100%, 100% 0)' }} />
      </section>

      {/* What is Jericho */}
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
              <p className="text-accent-foreground font-semibold uppercase tracking-wide text-sm">About Jericho</p>
              <h2 className="text-3xl md:text-4xl font-bold text-primary">What is Jericho?</h2>
            </motion.div>

            <motion.div variants={fadeIn} className="bg-background/80 backdrop-blur-sm rounded-2xl p-8 border border-primary/10 shadow-lg">
              <p className="text-lg text-primary leading-relaxed mb-6">
                <span className="font-semibold text-accent">Jericho</span> is an AI-driven performance management system that replaces outdated annual reviews with continuous growth. It combines capability frameworks, personalized coaching, and real-time analytics to help organizations build high-performing teams.
              </p>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-primary flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                      <Target className="w-4 h-4 text-accent" />
                    </div>
                    For Employees
                  </h3>
                  <ul className="space-y-2 text-muted-foreground text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                      <span>AI coach (Jericho) that guides daily growth</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                      <span>Personalized learning roadmaps & resources</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                      <span>Clear capability frameworks showing what "great" looks like</span>
                    </li>
                  </ul>
                </div>
                
                <div className="space-y-4">
                  <h3 className="font-semibold text-primary flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                      <Users className="w-4 h-4 text-accent" />
                    </div>
                    For Leaders
                  </h3>
                  <ul className="space-y-2 text-muted-foreground text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                      <span>Real-time visibility into team growth & engagement</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                      <span>Data-driven 1:1s that replace guesswork</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                      <span>Retention insights & capability gap analysis</span>
                    </li>
                  </ul>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-primary/10">
                <p className="text-center text-muted-foreground text-sm">
                  <span className="font-medium text-primary">The result:</span> Leaders get their time back. Employees own their growth. Organizations scale without chaos.
                </p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Who This Is For */}
      <section className="py-12 px-6 bg-muted/30 relative">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="space-y-8"
          >
            <motion.div variants={fadeIn} className="text-center space-y-2">
              <p className="text-accent font-semibold uppercase tracking-wide text-sm">Perfect For</p>
              <h2 className="text-3xl md:text-4xl font-bold text-primary">This Partnership Is For You If You're...</h2>
            </motion.div>

            <motion.div variants={fadeIn} className="grid md:grid-cols-2 gap-4">
              {[
                "A consultant, coach, or advisor working with growing organizations",
                "Connected to leaders who are frustrated with accountability gaps",
                "Someone who believes in recommending tools that actually work",
                "Looking for passive income from relationships you've already built"
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-5 bg-card rounded-xl border border-border shadow-sm hover:shadow-md hover:border-accent/30 transition-all duration-300">
                  <CheckCircle2 className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                  <p className="text-primary font-medium">{item}</p>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-14 px-6 bg-gradient-to-b from-background to-muted/30 relative">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="space-y-10"
          >
            <motion.div variants={fadeIn} className="text-center space-y-2">
              <p className="text-accent font-semibold uppercase tracking-wide text-sm">Simple Process</p>
              <h2 className="text-3xl md:text-4xl font-bold">How the Partner Program Works</h2>
            </motion.div>

            <motion.div variants={fadeIn} className="grid md:grid-cols-3 gap-6">
              {[
                {
                  icon: Target,
                  step: "1",
                  title: "Sign Up in 30 Seconds",
                  description: "Create your free partner account and get your unique referral link instantly."
                },
                {
                  icon: Users,
                  step: "2",
                  title: "Share With Your Network",
                  description: "Send your link to leaders who need better clarity, accountability, and growth systems."
                },
                {
                  icon: DollarSign,
                  step: "3",
                  title: "Earn 10% Commission",
                  description: "When they become a customer, you earn 10% of their first year. No cap on earnings."
                }
              ].map((item, i) => (
                <div key={i} className="group p-6 bg-card rounded-xl border border-border hover:border-accent/50 hover:shadow-lg hover:shadow-accent/5 transition-all duration-300 text-center">
                  <div className="w-14 h-14 bg-gradient-to-br from-accent/20 to-accent/10 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:from-accent/30 group-hover:to-accent/20 transition-all">
                    <item.icon className="h-7 w-7 text-accent" />
                  </div>
                  <div className="text-xs font-bold text-accent mb-2">STEP {item.step}</div>
                  <h3 className="text-lg font-semibold mb-2 text-primary">{item.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{item.description}</p>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* What You're Recommending */}
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
                <span className="text-accent font-semibold uppercase tracking-wide text-xs">What You're Recommending</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold">Jericho Solves Real Problems</h2>
              <p className="text-primary-foreground/70 max-w-2xl mx-auto">
                You're not pushing software — you're solving the #1 frustration leaders face: carrying everything because their people lack clarity and systems.
              </p>
            </motion.div>

            <motion.div variants={fadeIn} className="grid md:grid-cols-2 gap-4">
              {[
                "Employees who know exactly what 'great' looks like in their role",
                "Clear execution rhythms: quarterly targets → 30-day benchmarks → 7-day sprints",
                "Data-driven 1:1s that replace emotional check-ins",
                "Leaders who get their capacity back"
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-4 bg-primary-foreground/5 backdrop-blur-sm rounded-lg border border-primary-foreground/10">
                  <CheckCircle2 className="h-5 w-5 text-accent flex-shrink-0" />
                  <p className="text-primary-foreground font-medium">{item}</p>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Earnings Example */}
      <section className="py-12 px-6 bg-highlight-gold relative">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="space-y-8"
          >
            <motion.div variants={fadeIn} className="text-center space-y-2">
              <Gift className="w-10 h-10 text-accent mx-auto" />
              <h2 className="text-3xl md:text-4xl font-bold text-primary">The Math Is Simple</h2>
            </motion.div>

            <motion.div variants={fadeIn} className="bg-background rounded-2xl p-8 shadow-lg border border-primary/10">
              <div className="grid md:grid-cols-3 gap-6 text-center">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Average Deal Size</p>
                  <p className="text-3xl font-bold text-primary">$25,000<span className="text-lg font-normal text-muted-foreground">/year</span></p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Your Commission</p>
                  <p className="text-3xl font-bold text-accent">$2,500<span className="text-lg font-normal text-muted-foreground">/referral</span></p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">5 Referrals =</p>
                  <p className="text-3xl font-bold text-primary">$12,500</p>
                </div>
              </div>
              <p className="text-center text-muted-foreground mt-6 text-sm">
                No cap on earnings. The more you refer, the more you earn.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Registration Form */}
      <section className="py-16 px-6 bg-primary relative overflow-hidden" id="register">
        <div className="absolute top-0 -left-32 w-[400px] h-[400px] bg-accent/10 rounded-full blur-[100px]" />
        
        <div className="max-w-md mx-auto relative">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
            className="text-center mb-8"
          >
            <h2 className="text-3xl font-bold text-primary-foreground mb-2">Become a Partner</h2>
            <p className="text-primary-foreground/70">Join in 30 seconds. Start earning today.</p>
          </motion.div>

          <Card className="border-primary-foreground/10 bg-primary-foreground/5 backdrop-blur">
            <CardContent className="pt-6">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-primary-foreground">Full Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Smith"
                    required
                    className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50 focus:border-accent"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-primary-foreground">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@company.com"
                    required
                    className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50 focus:border-accent"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-primary-foreground">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50 focus:border-accent"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company" className="text-primary-foreground">Company <span className="text-primary-foreground/50">(Optional)</span></Label>
                  <Input
                    id="company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Acme Consulting"
                    className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50 focus:border-accent"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-primary-foreground">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50 focus:border-accent"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg shadow-accent/30 text-lg py-6"
                  disabled={loading}
                >
                  {loading ? "Creating Account..." : "Join Partner Program"}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </form>
              <div className="mt-4 text-center">
                <p className="text-sm text-primary-foreground/60">
                  Already a partner?{" "}
                  <Link to="/partner/login" className="text-accent hover:underline font-medium">
                    Sign in
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-primary-foreground/50 mt-6">
            By joining, you agree to our partner terms. Commission paid on converted deals within 30 days of close.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 bg-primary border-t border-primary-foreground/10">
        <div className="max-w-5xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-accent-foreground" />
            </div>
            <span className="text-lg font-bold text-primary-foreground">Jericho</span>
          </div>
          <p className="text-sm text-primary-foreground/50">
            © {new Date().getFullYear()} The Momentum Company. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
