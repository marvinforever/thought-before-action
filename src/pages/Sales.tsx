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
  CheckCircle2,
  Sparkles,
  MessageSquare,
  Headphones,
  Flame,
  Route,
  Send,
  Smartphone,
  BarChart3,
  Users,
  Target,
  Clock,
  Mic,
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
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const Sales = () => {
  const [searchParams] = useSearchParams();
  const [showDemoForm, setShowDemoForm] = useState(false);
  const [demoName, setDemoName] = useState("");
  const [demoCompany, setDemoCompany] = useState("");
  const [demoEmail, setDemoEmail] = useState("");
  const [isSubmittingDemo, setIsSubmittingDemo] = useState(false);

  // Referral tracking
  useEffect(() => {
    const refCode = searchParams.get("ref");
    if (refCode) {
      localStorage.setItem("referral_code", refCode);
      localStorage.setItem("referral_timestamp", Date.now().toString());
      const sessionKey = `referral_click_${refCode}`;
      if (!sessionStorage.getItem(sessionKey)) {
        sessionStorage.setItem(sessionKey, "true");
        (async () => {
          try {
            const { data: partnerId } = await supabase.rpc(
              "get_partner_id_by_referral_code",
              { p_referral_code: refCode }
            );
            if (partnerId) {
              await supabase
                .from("referral_leads")
                .insert({ partner_id: partnerId, status: "clicked" });
            }
          } catch {}
        })();
      }
    }
  }, [searchParams]);

  const handleDemoRequest = () => setShowDemoForm(true);

  const handleDemoFormSubmit = async () => {
    if (!demoName.trim() || !demoEmail.trim()) return;
    setIsSubmittingDemo(true);
    const refCode =
      searchParams.get("ref") || localStorage.getItem("referral_code");
    window.open("https://calendar.app.google/v1xwnCaqnRJ57UmJ6", "_blank");
    setShowDemoForm(false);
    try {
      await supabase.from("demo_requests").insert({
        name: demoName.trim(),
        email: demoEmail.trim(),
        company: demoCompany.trim() || null,
        referral_code: refCode || null,
        utm_source: searchParams.get("utm_source"),
        utm_medium: searchParams.get("utm_medium"),
        utm_campaign: searchParams.get("utm_campaign"),
      });
    } catch {}
    if (refCode) {
      try {
        const { data: partnerId } = await supabase.rpc(
          "get_partner_id_by_referral_code",
          { p_referral_code: refCode }
        );
        if (partnerId) {
          await supabase.from("referral_leads").insert({
            partner_id: partnerId,
            lead_company: demoCompany.trim(),
            contact_name: demoName.trim(),
            lead_email: demoEmail.trim(),
            status: "demo_booked",
          });
        }
      } catch {}
    }
    setDemoName("");
    setDemoCompany("");
    setDemoEmail("");
    setIsSubmittingDemo(false);
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
            <Button
              variant="outline"
              onClick={() => setShowDemoForm(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDemoFormSubmit}
              disabled={
                !demoName.trim() ||
                !demoCompany.trim() ||
                !demoEmail.trim() ||
                isSubmittingDemo
              }
              className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {isSubmittingDemo ? "Opening..." : "Continue to Calendar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
        {/* ─── Navigation ─── */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-primary/95 backdrop-blur-md border-b border-primary">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center shadow-lg shadow-accent/30">
                <span className="text-lg font-bold text-accent-foreground">
                  J
                </span>
              </div>
              <div>
                <span className="text-xl font-bold text-primary-foreground">
                  Jericho
                </span>
                <span className="hidden sm:block text-[10px] text-primary-foreground/70 -mt-1">
                  by The Momentum Company
                </span>
              </div>
            </Link>
            <div className="flex items-center gap-3">
              <Link to="/auth">
                <Button
                  variant="ghost"
                  className="text-primary-foreground hover:bg-primary-foreground/10"
                >
                  Sign In
                </Button>
              </Link>
              <Button
                className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg shadow-accent/30"
                onClick={handleDemoRequest}
              >
                Book a Demo
              </Button>
            </div>
          </div>
        </nav>

        {/* ═══════════════════════════════════════════
            HERO — "Your Performance Coach."
        ═══════════════════════════════════════════ */}
        <section className="pt-28 pb-20 px-6 bg-primary relative overflow-hidden">
          <div className="absolute top-20 -right-40 w-[600px] h-[600px] bg-accent/15 rounded-full blur-[140px]" />
          <div className="absolute bottom-10 -left-40 w-[500px] h-[500px] bg-accent/10 rounded-full blur-[120px]" />

          <div className="max-w-4xl mx-auto text-center relative">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
              className="space-y-8"
            >
              <motion.div
                variants={fadeIn}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/20 border border-accent/30"
              >
                <Sparkles className="w-4 h-4 text-accent" />
                <span className="text-accent font-medium text-sm">
                  Performance coaching that shows up every day
                </span>
              </motion.div>

              <motion.h1
                variants={fadeIn}
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.08] text-primary-foreground"
              >
                Your Performance
                <br />
                <span className="text-accent">Coach.</span>
              </motion.h1>

              <motion.p
                variants={fadeIn}
                className="text-lg sm:text-xl text-primary-foreground/70 max-w-2xl mx-auto leading-relaxed"
              >
                Jericho is the coaching system that knows your goals, tracks your
                habits, and shows up in your pocket every morning — so your
                people grow without depending on you to push them.
              </motion.p>

              <motion.div
                variants={fadeIn}
                className="flex flex-col sm:flex-row gap-4 justify-center pt-2"
              >
                <Link to="/try">
                  <Button
                    size="lg"
                    className="bg-accent text-accent-foreground hover:bg-accent/90 text-lg px-8 py-6 shadow-xl shadow-accent/30 font-semibold group w-full sm:w-auto"
                  >
                    <MessageSquare className="w-5 h-5 mr-2" />
                    Try Jericho Free
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 text-lg px-8 py-6"
                  onClick={handleDemoRequest}
                >
                  Book a Demo
                </Button>
              </motion.div>

              <motion.p
                variants={fadeIn}
                className="text-sm text-primary-foreground/40"
              >
                3-minute conversation. No account needed. Get your free Growth
                Map.
              </motion.p>
            </motion.div>
          </div>

          {/* Angled divider */}
          <div
            className="absolute bottom-0 left-0 right-0 h-16 bg-background"
            style={{ clipPath: "polygon(0 100%, 100% 100%, 100% 0)" }}
          />
        </section>

        {/* ─── Client Logos ─── */}
        <section className="py-10 px-6 bg-background border-b border-border/50">
          <div className="max-w-5xl mx-auto">
            <p className="text-center text-sm text-muted-foreground mb-6 uppercase tracking-wider font-medium">
              Trusted by growing organizations
            </p>
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12 opacity-60">
              {[
                { src: loganLogo, alt: "Logan Contractors" },
                { src: mcmLogo, alt: "MCM" },
                { src: iasLogo, alt: "IAS" },
                { src: slcLogo, alt: "SLC" },
                { src: winfieldLogo, alt: "Winfield" },
                { src: agPartnersLogo, alt: "AG Partners" },
              ].map((logo) => (
                <img
                  key={logo.alt}
                  src={logo.src}
                  alt={logo.alt}
                  className="h-8 md:h-10 object-contain grayscale hover:grayscale-0 transition-all duration-300"
                />
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            THE PROBLEM
        ═══════════════════════════════════════════ */}
        <section className="py-20 px-6 bg-background">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="space-y-10"
            >
              <motion.div variants={fadeIn} className="text-center space-y-3">
                <p className="text-accent font-semibold uppercase tracking-wider text-sm">
                  The problem
                </p>
                <h2 className="text-3xl md:text-4xl font-bold text-primary">
                  Great leaders shouldn't have to carry
                  <br className="hidden md:block" /> every person's development
                  on their back.
                </h2>
              </motion.div>

              <motion.div variants={fadeIn} className="grid md:grid-cols-2 gap-4">
                {[
                  "Training happens once — then fades",
                  "Goals get set in January and forgotten by March",
                  "1:1s become emotional check-ins instead of growth conversations",
                  "Your best people plateau because nobody's coaching them daily",
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-5 bg-muted/50 rounded-xl border border-border"
                  >
                    <span className="mt-1 w-2 h-2 rounded-full bg-destructive shrink-0" />
                    <p className="text-foreground font-medium text-[15px]">
                      {item}
                    </p>
                  </div>
                ))}
              </motion.div>

              <motion.div
                variants={fadeIn}
                className="bg-primary rounded-2xl p-8 text-center"
              >
                <p className="text-primary-foreground/70 text-lg">
                  The gap isn't talent. It's{" "}
                  <span className="text-accent font-semibold">
                    a system that shows up every single day.
                  </span>
                </p>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            HOW JERICHO WORKS
        ═══════════════════════════════════════════ */}
        <section className="py-20 px-6 bg-primary text-primary-foreground relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-accent/8 rounded-full blur-[100px]" />

          <div className="max-w-6xl mx-auto relative">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="space-y-12"
            >
              <motion.div variants={fadeIn} className="text-center space-y-3">
                <p className="text-accent font-semibold uppercase tracking-wider text-sm">
                  How it works
                </p>
                <h2 className="text-3xl md:text-4xl font-bold">
                  One coach. Every person. Every day.
                </h2>
                <p className="text-primary-foreground/60 max-w-2xl mx-auto text-lg">
                  Jericho learns each person's role, strengths, and growth
                  edges — then delivers coaching through the channels they
                  already use.
                </p>
              </motion.div>

              <motion.div
                variants={fadeIn}
                className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {[
                  {
                    icon: MessageSquare,
                    title: "3-Minute Diagnostic",
                    desc: "A conversation — not a form. Jericho maps strengths, gaps, and growth priorities in real-time.",
                  },
                  {
                    icon: BarChart3,
                    title: "Growth Map",
                    desc: "A personalized diagnostic that shows exactly where to focus — built from the conversation, delivered instantly.",
                  },
                  {
                    icon: Headphones,
                    title: "Daily Coaching Podcast",
                    desc: "Every morning, a personalized audio brief about their goals, wins, and what to focus on today.",
                  },
                  {
                    icon: Smartphone,
                    title: "Telegram & Text",
                    desc: "Jericho lives where your people already are. Voice notes, quick check-ins, coaching on the go.",
                  },
                  {
                    icon: Flame,
                    title: "Habits & Streaks",
                    desc: "Daily behaviors compound. Track the small things that drive big results over 90 days.",
                  },
                  {
                    icon: Route,
                    title: "Career Roadmaps",
                    desc: "Phased development plans tied to real capabilities — not generic competency checklists.",
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="group p-6 rounded-xl bg-primary-foreground/5 border border-primary-foreground/10 hover:border-accent/40 hover:bg-primary-foreground/8 transition-all duration-300"
                  >
                    <div className="w-12 h-12 bg-accent/15 rounded-xl flex items-center justify-center mb-4 group-hover:bg-accent/25 transition-colors">
                      <item.icon className="h-6 w-6 text-accent" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                    <p className="text-primary-foreground/60 text-sm leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            FOR LEADERS vs FOR INDIVIDUALS
        ═══════════════════════════════════════════ */}
        <section className="py-20 px-6 bg-background">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="space-y-12"
            >
              <motion.div variants={fadeIn} className="text-center space-y-3">
                <p className="text-accent font-semibold uppercase tracking-wider text-sm">
                  Built for both
                </p>
                <h2 className="text-3xl md:text-4xl font-bold text-primary">
                  Whether you lead a team or lead yourself.
                </h2>
              </motion.div>

              <motion.div variants={fadeIn} className="grid md:grid-cols-2 gap-8">
                {/* For Organizations */}
                <div className="rounded-2xl border border-border bg-card p-8 space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-accent/15 rounded-xl flex items-center justify-center">
                      <Users className="h-6 w-6 text-accent" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-primary">
                        For Organizations
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Deploy Jericho across your team
                      </p>
                    </div>
                  </div>
                  <ul className="space-y-3">
                    {[
                      "Every employee gets a personal coach on day one",
                      "Capability-based diagnostics replace generic reviews",
                      "Managers get data-backed 1:1 prep automatically",
                      "Daily coaching that doesn't depend on leader bandwidth",
                      "Organizational capability scores and gap analysis",
                    ].map((item, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-3 text-sm text-foreground"
                      >
                        <CheckCircle2 className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                    onClick={handleDemoRequest}
                  >
                    Book a Demo
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>

                {/* For Individuals */}
                <div className="rounded-2xl border border-accent/30 bg-gradient-to-br from-card to-highlight-gold/30 p-8 space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-accent/15 rounded-xl flex items-center justify-center">
                      <Target className="h-6 w-6 text-accent" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-primary">
                        For Individuals
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Start with a free Growth Map
                      </p>
                    </div>
                  </div>
                  <ul className="space-y-3">
                    {[
                      "3-minute conversation builds your personal diagnostic",
                      "See exactly where to focus to accelerate your career",
                      "Get daily coaching via Telegram or text",
                      "Track habits and build momentum with streaks",
                      "Career roadmap tailored to your goals and strengths",
                    ].map((item, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-3 text-sm text-foreground"
                      >
                        <CheckCircle2 className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Link to="/try">
                    <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Try Jericho Free
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            THE DAILY RHYTHM
        ═══════════════════════════════════════════ */}
        <section className="py-20 px-6 bg-highlight-gold">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="space-y-10"
            >
              <motion.div variants={fadeIn} className="text-center space-y-3">
                <p className="text-accent-foreground font-semibold uppercase tracking-wider text-sm">
                  The daily rhythm
                </p>
                <h2 className="text-3xl md:text-4xl font-bold text-primary">
                  What a day with Jericho looks like.
                </h2>
              </motion.div>

              <motion.div variants={fadeIn} className="space-y-4">
                {[
                  {
                    time: "6:30 AM",
                    icon: Headphones,
                    text: "Your personalized coaching podcast drops — wins from yesterday, focus for today, a challenge to stretch you.",
                  },
                  {
                    time: "9:00 AM",
                    icon: Smartphone,
                    text: "A Telegram nudge: "You said you'd delegate that project update. Did you?" Quick yes/no. Streak continues.",
                  },
                  {
                    time: "12:00 PM",
                    icon: Mic,
                    text: "Voice note to Jericho after a tough meeting. It coaches you through the frustration and reframes the situation.",
                  },
                  {
                    time: "4:00 PM",
                    icon: Send,
                    text: "Jericho preps your 1:1 agenda for tomorrow — data-backed talking points, not guesswork.",
                  },
                  {
                    time: "End of week",
                    icon: BarChart3,
                    text: "Weekly growth snapshot: streaks, capability progress, and what to focus on next week.",
                  },
                ].map((step, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-4 p-5 bg-background/80 rounded-xl border border-primary/8 shadow-sm"
                  >
                    <div className="flex flex-col items-center shrink-0 w-16">
                      <span className="text-xs font-bold text-accent-foreground uppercase tracking-wider">
                        {step.time}
                      </span>
                      <div className="w-10 h-10 bg-accent/15 rounded-lg flex items-center justify-center mt-1">
                        <step.icon className="h-5 w-5 text-accent" />
                      </div>
                    </div>
                    <p className="text-foreground text-[15px] leading-relaxed pt-1">
                      {step.text}
                    </p>
                  </div>
                ))}
              </motion.div>

              <motion.div variants={fadeIn} className="text-center">
                <p className="text-primary font-semibold text-lg">
                  This isn't a platform you log into.{" "}
                  <span className="text-accent">
                    It's a coach that shows up.
                  </span>
                </p>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            SOCIAL PROOF / RESULTS
        ═══════════════════════════════════════════ */}
        <section className="py-20 px-6 bg-primary text-primary-foreground">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="space-y-12"
            >
              <motion.div variants={fadeIn} className="text-center space-y-3">
                <p className="text-accent font-semibold uppercase tracking-wider text-sm">
                  Results
                </p>
                <h2 className="text-3xl md:text-4xl font-bold">
                  What happens when coaching never misses a day.
                </h2>
              </motion.div>

              <motion.div
                variants={fadeIn}
                className="grid sm:grid-cols-3 gap-6"
              >
                {[
                  {
                    stat: "90%",
                    label: "Daily engagement",
                    sub: "Because it meets people where they already are",
                  },
                  {
                    stat: "3 min",
                    label: "To a Growth Map",
                    sub: "From first conversation to personalized diagnostic",
                  },
                  {
                    stat: "365",
                    label: "Days of coaching",
                    sub: "Jericho never takes a day off",
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="text-center p-6 rounded-xl bg-primary-foreground/5 border border-primary-foreground/10"
                  >
                    <p className="text-4xl md:text-5xl font-extrabold text-accent">
                      {item.stat}
                    </p>
                    <p className="text-primary-foreground font-semibold mt-2">
                      {item.label}
                    </p>
                    <p className="text-primary-foreground/50 text-sm mt-1">
                      {item.sub}
                    </p>
                  </div>
                ))}
              </motion.div>

              <motion.div
                variants={fadeIn}
                className="bg-primary-foreground/5 border border-primary-foreground/10 rounded-2xl p-8 md:p-10"
              >
                <blockquote className="text-xl md:text-2xl text-primary-foreground/90 leading-relaxed font-medium italic text-center">
                  "Jericho isn't something we use. It's something our people
                  have. It shows up for them in a way we never could at scale."
                </blockquote>
                <p className="text-center text-accent mt-4 font-semibold">
                  — VP of Operations, Ag Services Company
                </p>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            FINAL CTA
        ═══════════════════════════════════════════ */}
        <section className="py-20 px-6 bg-background">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="space-y-8"
            >
              <motion.h2
                variants={fadeIn}
                className="text-3xl md:text-5xl font-bold text-primary leading-tight"
              >
                Your people deserve a coach
                <br />
                that never takes a day off.
              </motion.h2>

              <motion.p
                variants={fadeIn}
                className="text-lg text-muted-foreground max-w-xl mx-auto"
              >
                Start with a free Growth Map — a 3-minute conversation that
                shows you exactly where to focus. No account needed.
              </motion.p>

              <motion.div
                variants={fadeIn}
                className="flex flex-col sm:flex-row gap-4 justify-center"
              >
                <Link to="/try">
                  <Button
                    size="lg"
                    className="bg-accent text-accent-foreground hover:bg-accent/90 text-lg px-8 py-6 shadow-xl shadow-accent/30 font-semibold group w-full sm:w-auto"
                  >
                    <MessageSquare className="w-5 h-5 mr-2" />
                    Try Jericho Free
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-lg px-8 py-6"
                  onClick={handleDemoRequest}
                >
                  Book a Demo for Your Team
                </Button>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ─── Footer ─── */}
        <footer className="py-10 px-6 bg-primary border-t border-primary-foreground/10">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
                <span className="text-sm font-bold text-accent-foreground">
                  J
                </span>
              </div>
              <span className="text-primary-foreground font-semibold">
                Jericho
              </span>
              <span className="text-primary-foreground/40 text-sm">
                by The Momentum Company
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-primary-foreground/50">
              <Link
                to="/auth"
                className="hover:text-primary-foreground transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/try"
                className="hover:text-primary-foreground transition-colors"
              >
                Try Free
              </Link>
              <Link
                to="/academy"
                className="hover:text-primary-foreground transition-colors"
              >
                Academy
              </Link>
            </div>
            <p className="text-primary-foreground/30 text-sm">
              © {new Date().getFullYear()} The Momentum Company
            </p>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Sales;
