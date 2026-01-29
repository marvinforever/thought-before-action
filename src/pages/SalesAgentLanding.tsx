import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { 
  Sparkles, 
  MessageSquare, 
  FileText, 
  Headphones, 
  ClipboardList, 
  Brain,
  ArrowRight,
  Check,
  Wheat,
  Users,
  TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

// Import client logos
import agPartnersLogo from "@/assets/logos/ag-partners-logo.webp";
import loganLogo from "@/assets/logos/logan-contractors.avif";
import slcLogo from "@/assets/logos/slc-logo.png";
import mcmLogo from "@/assets/logos/mcm-logo.png";
import winfieldLogo from "@/assets/logos/winfield-logo.png";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

const askJerichoFeatures = [
  { icon: Wheat, text: "Need to make a grower rec?", description: "Get product recommendations based on their history and needs." },
  { icon: ClipboardList, text: "Can't remember what you sold them last season?", description: "Instant access to customer purchase history through conversation." },
  { icon: Users, text: "Your team hates CRM?", description: "That's okay. Just talk to Jericho—no forms, no data entry." },
  { icon: Headphones, text: "Need sales training on demand?", description: "Listen to personalized coaching podcasts anytime, anywhere." },
  { icon: MessageSquare, text: "Preparing for a big call?", description: "Get a complete prep document with talking points in seconds." },
  { icon: FileText, text: "Want a proposal written for you?", description: "Generate professional proposals from your conversation." },
];

const productFeatures = [
  "Conversational deal management—no forms, just talk",
  "Product recommendations tied to YOUR catalog",
  "Call prep documents generated in seconds",
  "Team knowledge podcasts for training on the go",
  "Proposal generation from conversation",
  "Complete customer history at your fingertips"
];

export default function SalesAgentLanding() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    companyName: "",
    role: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email) {
      toast({ title: "Please fill in your name and email", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('capture-sales-agent-lead', {
        body: formData
      });

      if (error) throw error;

      setSubmitted(true);
      toast({ title: "Thanks! We'll be in touch soon." });
    } catch (error) {
      console.error("Lead capture error:", error);
      toast({ title: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Jericho Sales Agent - Be the Pro Your Growers Expect</title>
        <meta name="description" content="Walk into every grower conversation with the answers, the history, and the recommendations they need. Ask Jericho." />
        <meta property="og:title" content="Jericho Sales Agent - Be the Pro Your Growers Expect" />
        <meta property="og:description" content="Walk into every grower conversation with the answers, the history, and the recommendations they need. Ask Jericho." />
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-primary text-primary-foreground">
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary/90" />
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-10 left-10 w-72 h-72 bg-accent rounded-full blur-3xl" />
            <div className="absolute bottom-10 right-10 w-96 h-96 bg-accent rounded-full blur-3xl" />
          </div>
          
          <div className="relative container mx-auto px-6 py-12 md:py-20">
            <motion.div 
              className="max-w-4xl mx-auto text-center"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="inline-flex items-center gap-2 bg-accent/20 text-accent px-4 py-2 rounded-full mb-6">
                <Sparkles className="h-4 w-4" />
                <span className="text-sm font-medium">AI-Powered Sales Assistant</span>
              </div>
              
              <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
                Be the Pro Your <br />
                <span className="text-accent">Growers Expect</span>
              </h1>
              
              <p className="text-xl md:text-2xl text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
                Walk into every conversation with the answers, the history, and the recommendations they need.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg" 
                  className="bg-accent text-accent-foreground hover:bg-accent/90 text-lg px-8"
                  onClick={() => document.getElementById('lead-form')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  Start Free <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
                  onClick={() => navigate('/auth')}
                >
                  Sign In
                </Button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Problem Section */}
        <section className="py-12 bg-muted/30">
          <div className="container mx-auto px-6">
            <motion.div 
              className="max-w-3xl mx-auto text-center"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
            >
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-8">
                Sound Familiar?
              </h2>
              
              <div className="space-y-4 text-left">
                {[
                  "Your team won't use CRM. You know it. They know it.",
                  "Product knowledge lives in people's heads—not systems.",
                  "You can't remember what you sold them last season.",
                  "Training happens once a year... then gets forgotten.",
                  "Every grower conversation feels like starting over."
                ].map((problem, index) => (
                  <motion.div
                    key={index}
                    className="flex items-start gap-3 bg-card p-4 rounded-lg shadow-sm border"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div className="h-6 w-6 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-destructive font-bold text-sm">!</span>
                    </div>
                    <p className="text-base text-foreground">{problem}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* Promise Section */}
        <section className="py-12 bg-background">
          <div className="container mx-auto px-6">
            <motion.div 
              className="max-w-4xl mx-auto"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
            >
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div className="bg-muted/50 p-6 rounded-xl border">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Before Jericho</h3>
                  <ul className="space-y-3">
                    {[
                      "Scrambling for notes before calls",
                      "Guessing at customer history",
                      "Winging product recommendations",
                      "Forgetting follow-up details",
                      "Manual data entry (that never happens)"
                    ].map((item, i) => (
                      <li key={i} className="flex items-center gap-3 text-muted-foreground">
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/50" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="bg-accent/10 p-6 rounded-xl border border-accent/20">
                  <h3 className="text-sm font-semibold text-accent uppercase tracking-wide mb-4">With Jericho</h3>
                  <ul className="space-y-3">
                    {[
                      "Prep docs generated in seconds",
                      "Complete customer history on demand",
                      "Smart recommendations from your catalog",
                      "Automatic conversation tracking",
                      "Just talk—Jericho handles the rest"
                    ].map((item, i) => (
                      <li key={i} className="flex items-center gap-3 text-foreground font-medium">
                        <Check className="h-5 w-5 text-accent" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Ask Jericho Section */}
        <section className="py-12 bg-primary text-primary-foreground">
          <div className="container mx-auto px-6">
            <motion.div 
              className="text-center mb-10"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
            >
              <h2 className="text-2xl md:text-3xl font-bold mb-3">
                Whatever You Need... <span className="text-accent">Ask Jericho</span>
              </h2>
              <p className="text-primary-foreground/70 text-lg max-w-2xl mx-auto">
                Your AI sales partner that understands ag, knows your products, and never forgets a detail.
              </p>
            </motion.div>

            <motion.div 
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto"
              variants={staggerContainer}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
            >
              {askJerichoFeatures.map((feature, index) => (
                <motion.div
                  key={index}
                  className="bg-primary-foreground/10 backdrop-blur-sm p-5 rounded-lg border border-primary-foreground/20 hover:border-accent/50 transition-colors"
                  variants={fadeInUp}
                >
                  <feature.icon className="h-6 w-6 text-accent mb-3" />
                  <h3 className="text-base font-semibold mb-1">{feature.text}</h3>
                  <p className="text-primary-foreground/70 text-sm">{feature.description}</p>
                  <p className="text-accent font-bold mt-3 text-sm">Ask Jericho.</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Proof Section - Client Logos */}
        <section className="py-10 bg-muted/30">
          <div className="container mx-auto px-6">
            <p className="text-center text-muted-foreground mb-6 text-sm">
              Trusted by ag sales teams across the Midwest
            </p>
            <div className="flex flex-wrap justify-center items-center gap-6 md:gap-12 opacity-70">
              <img src={agPartnersLogo} alt="AG Partners" className="h-8 md:h-10 object-contain grayscale hover:grayscale-0 transition-all" />
              <img src={loganLogo} alt="Logan Contractors" className="h-8 md:h-10 object-contain grayscale hover:grayscale-0 transition-all" />
              <img src={slcLogo} alt="SLC" className="h-8 md:h-10 object-contain grayscale hover:grayscale-0 transition-all" />
              <img src={mcmLogo} alt="MCM" className="h-8 md:h-10 object-contain grayscale hover:grayscale-0 transition-all" />
              <img src={winfieldLogo} alt="Winfield" className="h-8 md:h-10 object-contain grayscale hover:grayscale-0 transition-all" />
            </div>
          </div>
        </section>

        {/* Product Features */}
        <section className="py-12 bg-background">
          <div className="container mx-auto px-6">
            <motion.div 
              className="max-w-4xl mx-auto"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
            >
              <div className="text-center mb-8">
                <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                  Everything You Need to Succeed
                </h2>
                <p className="text-muted-foreground">
                  Built specifically for ag sales professionals
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {productFeatures.map((feature, index) => (
                  <motion.div
                    key={index}
                    className="flex items-center gap-3 bg-card p-4 rounded-lg border"
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <div className="h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <Check className="h-4 w-4 text-accent" />
                    </div>
                    <p className="text-foreground text-sm font-medium">{feature}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* Pricing Positioning */}
        <section className="py-10 bg-highlight-gold">
          <div className="container mx-auto px-6 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
            >
              <TrendingUp className="h-10 w-10 text-accent mx-auto mb-3" />
              <h2 className="text-xl md:text-2xl font-bold text-foreground mb-1">
                Start Free. Scale When Ready.
              </h2>
              <p className="text-muted-foreground text-sm">
                No credit card required. See the value before you commit.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Lead Capture Form */}
        <section id="lead-form" className="py-12 bg-primary text-primary-foreground">
          <div className="container mx-auto px-6">
            <motion.div 
              className="max-w-xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <div className="text-center mb-6">
                <Sparkles className="h-8 w-8 text-accent mx-auto mb-3" />
                <h2 className="text-2xl md:text-3xl font-bold mb-2">
                  Ready to Be the Pro?
                </h2>
                <p className="text-primary-foreground/70">
                  Get early access to Jericho Sales Agent
                </p>
              </div>

              {submitted ? (
                <div className="bg-accent/20 p-6 rounded-xl text-center">
                  <Check className="h-10 w-10 text-accent mx-auto mb-3" />
                  <h3 className="text-lg font-bold mb-2">You're on the list!</h3>
                  <p className="text-primary-foreground/70 mb-4 text-sm">
                    We'll be in touch soon to get you started.
                  </p>
                  <Button
                    className="bg-accent text-accent-foreground hover:bg-accent/90"
                    onClick={() => navigate('/auth')}
                  >
                    Sign Up Now <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="bg-primary-foreground/10 p-6 rounded-xl border border-primary-foreground/20">
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="name" className="text-primary-foreground">Name *</Label>
                      <Input
                        id="name"
                        placeholder="Your name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50"
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="email" className="text-primary-foreground">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="your@email.com"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50"
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="company" className="text-primary-foreground">Company Name</Label>
                      <Input
                        id="company"
                        placeholder="Your company"
                        value={formData.companyName}
                        onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                        className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="role" className="text-primary-foreground">Your Role</Label>
                      <Select 
                        value={formData.role} 
                        onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}
                      >
                        <SelectTrigger className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground">
                          <SelectValue placeholder="Select your role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vp_sales">VP of Sales</SelectItem>
                          <SelectItem value="vp_agronomy">VP of Agronomy</SelectItem>
                          <SelectItem value="ceo">CEO / Owner</SelectItem>
                          <SelectItem value="sales_manager">Sales Manager</SelectItem>
                          <SelectItem value="sales_agent">Sales Agent</SelectItem>
                          <SelectItem value="agronomist">Agronomist</SelectItem>
                          <SelectItem value="sales_rep">Sales Representative</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button 
                      type="submit" 
                      size="lg"
                      className="w-full bg-accent text-accent-foreground hover:bg-accent/90 mt-2"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Submitting..." : "Get Early Access"}
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 bg-primary border-t border-primary-foreground/10">
          <div className="container mx-auto px-6 text-center">
            <div className="flex items-center justify-center gap-2 text-primary-foreground/70">
              <Sparkles className="h-5 w-5 text-accent" />
              <span>Jericho Sales Agent</span>
            </div>
            <p className="text-primary-foreground/50 text-sm mt-2">
              Built for ag sales professionals
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
