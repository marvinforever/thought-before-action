import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";
import {
  ArrowUpRight,
  Download,
  Loader2,
  ClipboardCheck,
  BookOpen,
  Mic,
  Target,
  FileText,
  MessageSquare,
  LayoutDashboard,
  Users,
  TrendingUp,
  Layers,
  CalendarCheck,
  Award,
  Shield,
} from "lucide-react";

import slcLogo from "@/assets/logos/slc-logo.png";
import agPartnersLogo from "@/assets/logos/ag-partners-logo.webp";
import winfieldLogo from "@/assets/logos/winfield-logo.png";
import momentumIconDark from "@/assets/logos/momentum-icon-white.jpg"; // black mark on white bg

const slides = [
  { id: "moment", label: "Brandt's Moment" },
  { id: "meet", label: "Meet Jericho" },
  { id: "sellers", label: "For Sellers" },
  { id: "leaders", label: "For Leaders" },
  { id: "plays", label: "Two Plays" },
  { id: "close", label: "Activation Layer" },
];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const } },
};

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

function SlideShell({
  index,
  id,
  children,
  eyebrow,
}: {
  index: number;
  id: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      data-slide={index}
      className="pitch-slide relative w-full min-h-screen snap-start flex items-center justify-center px-6 sm:px-10 lg:px-20 py-20 lg:py-24"
    >
      <div className="grain-overlay pointer-events-none absolute inset-0 opacity-[0.04]" aria-hidden />
      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: false, amount: 0.35 }}
        className="relative w-full max-w-6xl"
      >
        {eyebrow && (
          <motion.div
            variants={fadeUp}
            className="mb-6 flex items-center gap-3 text-xs font-medium tracking-[0.2em] uppercase text-accent"
          >
            <span className="h-px w-10 bg-accent" />
            {eyebrow}
          </motion.div>
        )}
        {children}
      </motion.div>
    </section>
  );
}

export default function PitchBrandt() {
  const [active, setActive] = useState(0);
  const [exporting, setExporting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track active slide via IntersectionObserver
  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>(".pitch-slide");
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && e.intersectionRatio > 0.55) {
            const idx = Number(e.target.getAttribute("data-slide"));
            setActive(idx);
          }
        });
      },
      { threshold: [0.55, 0.75] }
    );
    sections.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (["ArrowDown", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        goTo(Math.min(active + 1, slides.length - 1));
      } else if (["ArrowUp", "PageUp"].includes(e.key)) {
        e.preventDefault();
        goTo(Math.max(active - 1, 0));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active]);

  const goTo = (i: number) => {
    const el = document.getElementById(slides[i].id);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const downloadPDF = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      // Landscape Letter: 11 x 8.5 inches
      const pdf = new jsPDF({ orientation: "landscape", unit: "in", format: "letter" });
      const pageW = pdf.internal.pageSize.getWidth();   // 11
      const pageH = pdf.internal.pageSize.getHeight();  // 8.5
      const margin = 0.5; // inches — top/bottom/left/right
      const contentW = pageW - margin * 2;
      const contentH = pageH - margin * 2;

      const slideEls = Array.from(
        document.querySelectorAll<HTMLElement>(".pitch-slide")
      );

      // Make sure every slide has been scrolled into view at least once so
      // framer-motion has run its `whileInView` enter animation. Without this,
      // un-scrolled slides remain at opacity:0 and render as blank pages.
      const scroller = document.querySelector<HTMLElement>(".pitch-scroll");
      const originalScroll = scroller?.scrollTop ?? 0;
      for (const s of slideEls) {
        s.scrollIntoView({ behavior: "auto", block: "start" });
        // give framer-motion a tick to flip styles to visible
        await new Promise((r) => setTimeout(r, 250));
      }
      scroller?.scrollTo({ top: originalScroll, behavior: "auto" });
      await new Promise((r) => setTimeout(r, 100));

      for (let i = 0; i < slideEls.length; i++) {
        const el = slideEls[i];
        // Render the slide off-screen at a fixed deck aspect ratio so layout
        // matches the landscape page (no mobile single-column collapse).
        const RENDER_W = 1600;
        const RENDER_H = Math.round((RENDER_W * contentH) / contentW);

        const clone = el.cloneNode(true) as HTMLElement;
        // Force every motion child visible in case framer-motion left it hidden.
        clone.querySelectorAll<HTMLElement>("*").forEach((node) => {
          const s = node.style;
          if (s.opacity === "0" || parseFloat(s.opacity) === 0) s.opacity = "1";
          // Strip transforms that translate content off-screen during enter anim
          if (s.transform && /translate|matrix/i.test(s.transform)) s.transform = "none";
        });
        const wrap = document.createElement("div");
        wrap.style.position = "fixed";
        wrap.style.left = "-10000px";
        wrap.style.top = "0";
        wrap.style.width = `${RENDER_W}px`;
        wrap.style.height = `${RENDER_H}px`;
        wrap.style.background = "hsl(var(--background))";
        wrap.style.overflow = "hidden";
        clone.style.minHeight = `${RENDER_H}px`;
        clone.style.height = `${RENDER_H}px`;
        clone.style.width = `${RENDER_W}px`;
        clone.style.padding = "72px 88px";
        clone.style.display = "flex";
        clone.style.alignItems = "center";
        clone.style.justifyContent = "center";
        // Strip floating UI artifacts
        clone.querySelectorAll(".pitch-floating, .grain-overlay").forEach((n) => n.remove());
        wrap.appendChild(clone);
        document.body.appendChild(wrap);

        try {
          const canvas = await html2canvas(clone, {
            scale: 2,
            backgroundColor: "#ffffff",
            useCORS: true,
            logging: false,
            windowWidth: RENDER_W,
            windowHeight: RENDER_H,
          });
          const img = canvas.toDataURL("image/jpeg", 0.92);
          if (i > 0) pdf.addPage();
          pdf.addImage(img, "JPEG", margin, margin, contentW, contentH);

          // Footer
          pdf.setFontSize(8);
          pdf.setTextColor(130, 140, 155);
          pdf.text(
            "Jericho × Brandt — Confidential",
            margin,
            pageH - 0.22
          );
          pdf.text(
            `${i + 1} / ${slideEls.length}`,
            pageW - margin,
            pageH - 0.22,
            { align: "right" }
          );
        } finally {
          document.body.removeChild(wrap);
        }
      }

      pdf.save("jericho-brandt-pitch.pdf");
    } catch (err) {
      console.error("PDF export failed", err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Jericho × Brandt — A Private Pitch</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta
          name="description"
          content="A private pitch for Brandt: equip your sellers and add value to your retailers with Jericho — the AI sales coach built for ag."
        />
      </Helmet>

      <style>{`
        .pitch-root {
          background: hsl(var(--background));
          color: hsl(var(--foreground));
          font-feature-settings: "ss01", "cv11";
        }
        .pitch-scroll {
          scroll-snap-type: y mandatory;
          height: 100vh;
          overflow-y: scroll;
          scroll-behavior: smooth;
        }
        .grain-overlay {
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          mix-blend-mode: multiply;
        }
        .earth-bg {
          background:
            radial-gradient(ellipse at top left, hsl(45 100% 48% / 0.08), transparent 55%),
            radial-gradient(ellipse at bottom right, hsl(211 51% 24% / 0.06), transparent 55%),
            linear-gradient(180deg, hsl(var(--background)), hsl(45 30% 97%));
        }
        .display-serif {
          font-family: ui-serif, Georgia, "Times New Roman", serif;
          letter-spacing: -0.02em;
        }
        @media print {
          .pitch-scroll { height: auto !important; overflow: visible !important; scroll-snap-type: none !important; }
          .pitch-slide { min-height: auto !important; page-break-after: always; padding: 2rem !important; }
          .pitch-floating { display: none !important; }
          .grain-overlay { display: none !important; }
        }
      `}</style>

      <div className="pitch-root earth-bg">
        {/* Floating slide indicator + exit */}
        <div className="pitch-floating fixed top-5 right-5 z-50 flex items-center gap-2">
          <a
            href="https://askjericho.com"
            className="px-3 py-2 rounded-full bg-card/80 backdrop-blur border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Exit ↗
          </a>
          <div className="px-3 py-2 rounded-full bg-card/80 backdrop-blur border border-border flex items-center gap-2">
            {slides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => goTo(i)}
                aria-label={`Go to ${s.label}`}
                className={`h-2 w-2 rounded-full transition-all ${
                  i === active ? "bg-accent w-6" : "bg-muted-foreground/30 hover:bg-muted-foreground/60"
                }`}
              />
            ))}
            <span className="ml-2 text-xs font-mono text-muted-foreground tabular-nums">
              {String(active + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
            </span>
          </div>
        </div>

        {/* Floating download */}
        <button
          onClick={downloadPDF}
          disabled={exporting}
          className="pitch-floating fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-lg hover:opacity-90 transition-opacity disabled:opacity-70"
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {exporting ? "Generating PDF…" : "Download PDF"}
        </button>

        <div ref={containerRef} className="pitch-scroll">
          {/* SLIDE 1 — Brandt's Moment */}
          <SlideShell index={0} id="moment" eyebrow="Prepared for Brandt · Confidential">
            <motion.h1
              variants={fadeUp}
              className="display-serif text-5xl sm:text-6xl lg:text-8xl font-semibold text-primary leading-[0.95]"
            >
              Brandt's Moment.
            </motion.h1>
            <motion.p
              variants={fadeUp}
              className="mt-8 max-w-3xl text-xl lg:text-2xl text-muted-foreground leading-relaxed"
            >
              A complex portfolio. A growing team. A retailer-focused sales motion that needs
              more than field days.
            </motion.p>

            <motion.div
              variants={stagger}
              className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-2xl overflow-hidden border border-border"
            >
              {[
                { stat: "30", unit: "field sellers", detail: "across 5 regional teams" },
                { stat: "15–16", unit: "top targets / territory", detail: "deep relationships, not transactional" },
                { stat: "250+", unit: "products", detail: "crop protection, nutrition, biologicals, adjuvants, specialty" },
                { stat: "New", unit: "sellers ramping", detail: "on the full portfolio, fast" },
                { stat: "2", unit: "opportunities", detail: "equip your sales force AND add value at the retailer" },
                { stat: "1", unit: "platform", detail: "to do both" },
              ].map((b) => (
                <motion.div
                  key={b.unit}
                  variants={fadeUp}
                  className="bg-card p-8 lg:p-10 flex flex-col gap-2"
                >
                  <div className="display-serif text-5xl lg:text-6xl text-primary font-semibold">{b.stat}</div>
                  <div className="text-sm font-medium uppercase tracking-wider text-accent-foreground/70">
                    {b.unit}
                  </div>
                  <div className="text-base text-muted-foreground leading-snug mt-1">{b.detail}</div>
                </motion.div>
              ))}
            </motion.div>
          </SlideShell>

          {/* SLIDE 2 — Meet Jericho */}
          <SlideShell index={1} id="meet" eyebrow="The platform">
            <motion.h2
              variants={fadeUp}
              className="display-serif text-5xl sm:text-6xl lg:text-7xl font-semibold text-primary leading-[1]"
            >
              Meet Jericho.
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="mt-6 max-w-3xl text-xl lg:text-2xl text-muted-foreground leading-relaxed"
            >
              An AI-powered sales coach and fractional Chief Learning Officer that lives in your
              reps' pockets.
            </motion.p>

            <motion.div
              variants={fadeUp}
              className="mt-10 inline-flex items-center gap-3 px-5 py-3 rounded-full bg-primary text-primary-foreground text-sm font-medium"
            >
              <Award className="h-4 w-4 text-accent" />
              Built by The Momentum Company — 20+ years serving the ag industry.
            </motion.div>

            <motion.div variants={stagger} className="mt-14 grid md:grid-cols-2 gap-6">
              {[
                {
                  icon: MessageSquare,
                  title: "Available at askjericho.com",
                  body: "Text, app, or web. No install required.",
                },
                {
                  icon: Layers,
                  title: "Two halves, one platform",
                  body: "A real-time sales agent in the moment, plus a performance management system over time.",
                },
                {
                  icon: TrendingUp,
                  title: "Battle-tested in ag",
                  body: "Originally built for Stateline Cooperative as a fractional CLO. Now deployed across multiple ag organizations.",
                },
                {
                  icon: Shield,
                  title: "Branded as yours",
                  body: "Every output, proposal, and recommendation carries the Brandt name. Powered by Anthropic's Claude. Brandt's data fully siloed in a private knowledge base.",
                },
              ].map((c) => (
                <motion.div
                  key={c.title}
                  variants={fadeUp}
                  className="p-7 rounded-2xl border border-border bg-card hover:shadow-lg transition-shadow"
                >
                  <c.icon className="h-6 w-6 text-accent" />
                  <div className="mt-4 text-lg font-semibold text-primary">{c.title}</div>
                  <div className="mt-2 text-base text-muted-foreground leading-relaxed">{c.body}</div>
                </motion.div>
              ))}
            </motion.div>
          </SlideShell>

          {/* SLIDE 3 — For Sellers */}
          <SlideShell index={2} id="sellers" eyebrow="In the moment">
            <motion.h2
              variants={fadeUp}
              className="display-serif text-5xl sm:text-6xl lg:text-7xl font-semibold text-primary leading-[1]"
            >
              For your sellers,<br />in the moment.
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="mt-6 max-w-2xl text-xl text-muted-foreground leading-relaxed"
            >
              Everything a rep needs in the moment they need it.
            </motion.p>

            <motion.div variants={stagger} className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                {
                  icon: ClipboardCheck,
                  title: "Pre-call planning",
                  body: "Complete plans in any methodology — SPIN, Sandler, or your own.",
                },
                {
                  icon: BookOpen,
                  title: "Product knowledge on demand",
                  body: "Every Brandt product: rates, MOA, tank-mix, timing, competitive positioning.",
                },
                {
                  icon: FileText,
                  title: "Automatic deal capture",
                  body: "Drop a call recording. Jericho logs the deal, updates the pipeline, drafts follow-ups.",
                },
                {
                  icon: Target,
                  title: "Coaching with objective scoring",
                  body: "Real-time feedback. Third-party, not big-brother.",
                },
                {
                  icon: FileText,
                  title: "Branded proposals",
                  body: "Customer-ready proposals in minutes, with Brandt branding.",
                },
                {
                  icon: Mic,
                  title: "Voice or text",
                  body: "Reps speak or chat. It works the way they already work.",
                },
              ].map((f) => (
                <motion.div
                  key={f.title}
                  variants={fadeUp}
                  className="group p-6 rounded-2xl border border-border bg-card hover:border-accent transition-colors"
                >
                  <div className="h-11 w-11 rounded-xl bg-highlight-gold flex items-center justify-center">
                    <f.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="mt-5 text-lg font-semibold text-primary">{f.title}</div>
                  <div className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.body}</div>
                </motion.div>
              ))}
            </motion.div>
          </SlideShell>

          {/* SLIDE 4 — For Leaders */}
          <SlideShell index={3} id="leaders" eyebrow="Over time">
            <motion.h2
              variants={fadeUp}
              className="display-serif text-5xl sm:text-6xl lg:text-7xl font-semibold text-primary leading-[1]"
            >
              For your sales leaders,<br />over time.
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="mt-6 max-w-3xl text-xl text-muted-foreground leading-relaxed"
            >
              Performance management that actually gets used — because the data shows up
              automatically.
            </motion.p>

            <motion.div variants={stagger} className="mt-14 grid lg:grid-cols-2 gap-4">
              {[
                { icon: LayoutDashboard, title: "Manager dashboard", body: "Full visibility into every team member." },
                { icon: CalendarCheck, title: "1:1 tracking", body: "Auto-notes, action items, overdue alerts." },
                { icon: TrendingUp, title: "Automated performance reviews", body: "Auto-generated from actual sales activity, 1:1 notes, and coaching history — not memory." },
                { icon: Layers, title: "Capability frameworks", body: "Foundational → Advancing → Independent → Mastery." },
                { icon: Target, title: "Growth plans", body: "Tied to 90-day targets, 30-day benchmarks, 7-day sprints." },
                { icon: Award, title: "Recognition system", body: "Lands in the rep's growth plan and inbox." },
                { icon: Users, title: "Tiered access", body: "Master admin, manager, individual contributor." },
              ].map((f) => (
                <motion.div
                  key={f.title}
                  variants={fadeUp}
                  className="p-5 rounded-xl border border-border bg-card flex items-start gap-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/5 flex items-center justify-center shrink-0">
                    <f.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-primary">{f.title}</div>
                    <div className="text-sm text-muted-foreground mt-1">{f.body}</div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </SlideShell>

          {/* SLIDE 5 — Two Plays */}
          <SlideShell index={4} id="plays" eyebrow="Built for Brandt">
            <motion.h2
              variants={fadeUp}
              className="display-serif text-5xl sm:text-6xl lg:text-7xl font-semibold text-primary leading-[1]"
            >
              Two plays.<br />One platform.
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="mt-6 max-w-3xl text-xl text-muted-foreground leading-relaxed"
            >
              Designed to flex to how Brandt actually goes to market.
            </motion.p>

            <motion.div variants={stagger} className="mt-14 grid md:grid-cols-2 gap-6">
              <motion.div
                variants={fadeUp}
                className="relative p-8 lg:p-10 rounded-2xl border border-border bg-card overflow-hidden"
              >
                <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-primary to-primary/40" />
                <div className="text-xs font-bold tracking-[0.25em] uppercase text-muted-foreground">
                  Play 01
                </div>
                <h3 className="mt-3 display-serif text-3xl lg:text-4xl text-primary font-semibold">
                  Equip your internal sales force
                </h3>
                <p className="mt-5 text-lg text-muted-foreground leading-relaxed">
                  Faster ramp on the 250+ portfolio. Continuous coaching. Instant product
                  expertise in the field.
                </p>
              </motion.div>

              <motion.div
                variants={fadeUp}
                className="relative p-8 lg:p-10 rounded-2xl border border-border bg-card overflow-hidden"
              >
                <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-accent to-accent/40" />
                <div className="text-xs font-bold tracking-[0.25em] uppercase text-muted-foreground">
                  Play 02
                </div>
                <h3 className="mt-3 display-serif text-3xl lg:text-4xl text-primary font-semibold">
                  Sponsor Jericho for key retailers
                </h3>
                <p className="mt-5 text-lg text-muted-foreground leading-relaxed">
                  Keystone-style accounts. A Brandt-funded value-add that differentiates you
                  from every other supplier.
                </p>
              </motion.div>
            </motion.div>

            <motion.div variants={fadeUp} className="mt-16 pt-10 border-t border-border">
              <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Trusted by ag's most respected operators
              </div>
              <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { name: "Streamline", note: "Live deployment", logo: null },
                  { name: "Stateline Cooperative", note: "3-year fractional CLO partnership", logo: slcLogo },
                  { name: "AgPartners", note: "Every location manager — \"life-changing\"", logo: agPartnersLogo },
                  { name: "Winfield Strategic Retail Alliance", note: "Sales manager development", logo: winfieldLogo },
                ].map((c) => (
                  <div key={c.name} className="flex flex-col gap-2">
                    <div className="h-10 flex items-center">
                      {c.logo ? (
                        <div className="inline-flex items-center justify-center h-10 px-3 rounded-md bg-primary">
                          <img src={c.logo} alt={c.name} className="max-h-7 max-w-[130px] object-contain" />
                        </div>
                      ) : (
                        <span className="display-serif text-2xl text-primary font-semibold">{c.name}</span>
                      )}
                    </div>
                    <div className="text-sm font-medium text-primary">{c.logo ? c.name : ""}</div>
                    <div className="text-sm text-muted-foreground leading-snug">{c.note}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </SlideShell>

          {/* SLIDE 6 — Activation Layer */}
          <SlideShell index={5} id="close" eyebrow="The closer">
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 30, scale: 0.97 },
                visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] as const } },
              }}
              className="relative"
            >
              <div className="display-serif text-4xl sm:text-5xl lg:text-7xl text-primary font-semibold leading-[1.05] max-w-5xl">
                <span className="text-accent">"</span>Jericho is the activation layer for your CRM.<span className="text-accent">"</span>
              </div>
            </motion.div>

            <motion.p
              variants={fadeUp}
              className="mt-10 max-w-3xl text-xl text-muted-foreground leading-relaxed"
            >
              The useful coach that actually helps reps get stuff done — drafts emails, reminds
              them what's on the calendar, surfaces what to follow up on. Not another data-entry
              tax.
            </motion.p>

            <motion.div variants={stagger} className="mt-14 space-y-3">
              {[
                "The first ag-forward tool of its kind.",
                "The first proven to make a real impact in the lives of ag sellers.",
                "Built by ag people, for ag people.",
              ].map((line) => (
                <motion.div
                  key={line}
                  variants={fadeUp}
                  className="display-serif text-2xl lg:text-3xl text-primary font-medium border-l-2 border-accent pl-5"
                >
                  {line}
                </motion.div>
              ))}
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="mt-16 pt-8 border-t border-border flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground"
            >
              <span className="font-semibold text-primary">Mark Jewell</span>
              <span>·</span>
              <a href="mailto:mark@themomentumcompany.com" className="hover:text-accent transition-colors">
                mark@themomentumcompany.com
              </a>
              <span>·</span>
              <a
                href="https://askjericho.com"
                className="inline-flex items-center gap-1 hover:text-accent transition-colors"
              >
                askjericho.com <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </motion.div>
          </SlideShell>
        </div>
      </div>
    </>
  );
}
