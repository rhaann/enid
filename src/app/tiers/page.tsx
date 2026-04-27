"use client";

import Link from "next/link";
import Image from "next/image";
import { Logo } from "@/components/Logo";
import { motion } from "framer-motion";
import { useRef, useState, useEffect } from "react";

const tiers = [
  {
    name: "Audit",
    fullName: "Audre Audit",
    tagline: "What's wrong.",
    headline: "See clearly.",
    description:
      "Get a clear snapshot of where your brand stands today. We identify the gaps, inconsistencies, and friction points holding you back.",
    price: "$750 – $1,250",
    color: "#17bfca",
    darkBg: false,
    gradient: "from-slate-50 via-cyan-50/30 to-white",
    features: [
      { 
        title: "Brand Audit", 
        desc: "",
        analyzes: ["Who You Are", "How You Look", "How You Sound", "Who You Serve", "Positioning & Market Fit"],
        outputs: ["Brand Strength Score", "3–5 Strategic Risks", "3–5 Immediate Fixes", "Snapshot Summary"]
      },
      { 
        title: "Website Audit", 
        desc: "",
        analyzes: ["Brand Expression & Visual", "Messaging & Clarity", "UX & Navigation", "Accessibility & Contrast", "CTAs, Trust & Conversion", "Social Consistency", "Risk & Confidence"],
        outputs: ["Website Score", "Top Friction Points", "High-Impact Fix Areas", "Executive Summary"]
      },
    ],
    slides: [
      { title: "Brand Score Card", desc: "Visual overview of your brand health across all dimensions" },
      { title: "Risk Assessment", desc: "Prioritized issues that need immediate attention" },
      { title: "Quick Wins Report", desc: "Actionable fixes you can implement today" },
    ],
    cta: "Get Started",
    ctaHref: "/brand_input",
  },
  {
    name: "Advantage",
    fullName: "Audre Advantage",
    tagline: "How you compare. What to fix first.",
    headline: "Compete smarter.",
    description:
      "Everything in Tier 1, plus competitive intelligence, deep social analysis, and a prioritized 90-day roadmap.",
    price: "$3,500 – $5,500",
    color: "#a855f7",
    darkBg: true,
    gradient: "from-[#1a1a2e] via-[#16213e] to-[#0f0f23]",
    features: [
      { 
        title: "Competitive Benchmarking", 
        desc: "Know exactly where you stand vs. competitors",
        outputs: ["Who's winning & why", "White space opportunities", "Risk if unchanged"]
      },
      { 
        title: "Social Media Deep Audit", 
        desc: "Channel-by-channel analysis across all platforms",
        outputs: ["Social Alignment Score", "Brand-to-Content Gap", "Next 5 Content Moves"]
      },
      { 
        title: "Distinctive Brand Assets", 
        desc: "Measure memorability and recall strength",
        outputs: ["Recall Score", "Memorability Gaps", "Elevation Opportunities"]
      },
      { 
        title: "Funnel Intelligence", 
        desc: "Find friction points limiting revenue",
        outputs: ["Conversion Strength Index", "Revenue Risk Flags", "Impact-ranked Fixes"]
      },
      { 
        title: "Investor Readiness", 
        desc: "Signals that matter to buyers & investors",
        outputs: ["Investor Readiness Score", "Exit Risk Index", "Pre-Diligence Cleanup"]
      },
      { 
        title: "90-Day Blueprint", 
        desc: "Structured 30/60/90 execution plan",
        outputs: ["Priority Fixes (0-30)", "Structural Improvements (30-60)", "Strategic Shifts (60-90)"]
      },
    ],
    slides: [
      { title: "Competitor Matrix", desc: "Side-by-side comparison showing where you win and lose" },
      { title: "Social Performance Report", desc: "Channel-by-channel engagement analysis" },
      { title: "90-Day Execution Roadmap", desc: "Week-by-week prioritized action plan" },
    ],
    cta: "Get Advantage",
    ctaHref: "/contact",
  },
  {
    name: "Ascend",
    fullName: "Audre Ascend",
    tagline: "We build it.",
    headline: "Transform completely.",
    description:
      "We don't just tell you what to fix — we fix it with you. Full partnership to execute strategic brand improvements.",
    price: "$10,000 – $18,000",
    color: "#f59e0b",
    darkBg: false,
    gradient: "from-amber-50/50 via-orange-50/30 to-white",
    features: [
      { title: "M&A Exit Amplifier", desc: "Strengthen before acquisition" },
      { title: "Investor Narrative", desc: "Compelling story development" },
      { title: "Competitive War Room", desc: "Strategic repositioning" },
      { title: "Asset Sprint", desc: "Visual and sonic elevation" },
      { title: "Conversion Sprint", desc: "Messaging optimization" },
      { title: "Executive Debrief", desc: "Leadership alignment" },
    ],
    slides: [
      { title: "Investor Deck", desc: "Polished narrative designed for funding conversations" },
      { title: "Brand Assets Package", desc: "Complete visual identity system refresh" },
      { title: "Executive Summary", desc: "Strategic overview and recommendations for leadership" },
    ],
    cta: "Contact Us",
    ctaHref: "/contact",
  },
];

function FeatureCard({
  feature,
  color,
  darkBg,
}: {
  feature: { title: string; desc: string; analyzes?: string[]; outputs?: string[] };
  color: string;
  darkBg: boolean;
}) {
  const hasFullLists = feature.analyzes && feature.outputs; // Tier 1 style (both sections)
  const hasOutputsOnly = !feature.analyzes && feature.outputs; // Tier 2 style (compact)
  
  return (
    <div
      className={`p-4 rounded-xl ${
        darkBg
          ? "bg-white/5 border border-white/10"
          : "bg-white/80 border border-zinc-200/50 shadow-sm"
      }`}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center mb-2"
        style={{ backgroundColor: `${color}20` }}
      >
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
      <h4
        className={`font-semibold text-sm mb-1 ${
          darkBg ? "text-white" : "text-zinc-900"
        }`}
      >
        {feature.title}
      </h4>
      
      {/* Compact style: desc as tagline + outputs */}
      {hasOutputsOnly && (
        <div>
          <p className={`text-xs mb-2 ${darkBg ? "text-white/50" : "text-zinc-500"}`}>
            {feature.desc}
          </p>
          <ul className="space-y-0.5">
            {feature.outputs!.map((item) => (
              <li key={item} className={`text-[11px] flex items-start gap-1.5 ${darkBg ? "text-white/70" : "text-zinc-600"}`}>
                <span style={{ color }} className="mt-0.5">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Full style: analyzes + outputs sections */}
      {hasFullLists && (
        <div className="space-y-3">
          {feature.analyzes && (
            <div>
              <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 ${darkBg ? "text-white/40" : "text-zinc-400"}`}>
                What we analyze
              </p>
              <ul className="space-y-1">
                {feature.analyzes.map((item) => (
                  <li key={item} className={`text-xs flex items-start gap-1.5 ${darkBg ? "text-white/70" : "text-zinc-600"}`}>
                    <span style={{ color }} className="mt-1">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {feature.outputs && (
            <div>
              <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 ${darkBg ? "text-white/40" : "text-zinc-400"}`}>
                What you get
              </p>
              <ul className="space-y-1">
                {feature.outputs.map((item) => (
                  <li key={item} className={`text-xs flex items-start gap-1.5 ${darkBg ? "text-white/70" : "text-zinc-600"}`}>
                    <span style={{ color }} className="mt-1">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      
      {/* Simple style: just description (Tier 3) */}
      {!hasOutputsOnly && !hasFullLists && feature.desc && (
        <p className={`text-xs leading-relaxed ${darkBg ? "text-white/50" : "text-zinc-500"}`}>
          {feature.desc}
        </p>
      )}
    </div>
  );
}

function TierSection({ tier, index }: { tier: (typeof tiers)[0]; index: number }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const totalSlides = 1 + tier.slides.length; // Main slide + example slides

  const handleScroll = () => {
    if (scrollRef.current) {
      const scrollLeft = scrollRef.current.scrollLeft;
      const slideWidth = scrollRef.current.offsetWidth;
      const newIndex = Math.round(scrollLeft / slideWidth);
      setActiveSlide(newIndex);
    }
  };

  const scrollToSlide = (index: number) => {
    if (scrollRef.current) {
      const slideWidth = scrollRef.current.offsetWidth;
      scrollRef.current.scrollTo({
        left: slideWidth * index,
        behavior: "smooth",
      });
    }
  };

  return (
    <section
      className={`relative min-h-[90vh] bg-gradient-to-b ${tier.gradient}`}
    >
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute w-[600px] h-[600px] rounded-full blur-3xl opacity-20"
          style={{
            background: `radial-gradient(circle, ${tier.color}50 0%, transparent 70%)`,
            top: "20%",
            right: "-10%",
          }}
        />
        {/* Grid pattern - only for light backgrounds */}
        {!tier.darkBg && (
          <div
            className="absolute inset-0 opacity-[0.015]"
            style={{
              backgroundImage: `linear-gradient(${tier.color} 1px, transparent 1px), linear-gradient(90deg, ${tier.color} 1px, transparent 1px)`,
              backgroundSize: "50px 50px",
            }}
          />
        )}
      </div>

      {/* Horizontal Scroll Container */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory h-[90vh]"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {/* Main Content Slide */}
        <div className="w-full h-full flex-shrink-0 snap-start">
          <div className="h-full flex items-center">
            <div className={`w-full mx-auto px-6 lg:px-10 ${tier.features.length <= 2 ? "max-w-7xl" : tier.features.length === 6 ? "max-w-7xl" : "max-w-6xl"}`}>
              <div className={`grid gap-8 lg:gap-12 items-center ${tier.features.length <= 2 ? "lg:grid-cols-[1fr_1.5fr]" : tier.features.length === 6 ? "lg:grid-cols-[1fr_2fr]" : "lg:grid-cols-2"}`}>
                {/* Left: Content */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                >
                  {/* Tier badge */}
                  <div
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium mb-4 ${
                      tier.darkBg
                        ? "bg-white/10 text-white/70"
                        : "bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: tier.color }}
                    />
                    Tier {index + 1}
                  </div>

                  {/* Headline */}
                  <h2
                    className={`text-4xl sm:text-5xl font-bold mb-2 tracking-tight ${
                      tier.darkBg ? "text-white" : "text-zinc-900"
                    }`}
                  >
                    {tier.headline}
                  </h2>

                  {/* Tier name */}
                  <p
                    className="text-lg sm:text-xl font-semibold mb-3"
                    style={{ color: tier.color }}
                  >
                    {tier.fullName}
                  </p>

                  {/* Description */}
                  <p
                    className={`text-sm leading-relaxed mb-4 max-w-sm ${
                      tier.darkBg ? "text-white/60" : "text-zinc-600"
                    }`}
                  >
                    {tier.description}
                  </p>

                  {/* Price */}
                  <div className="mb-4">
                    <span
                      className={`text-2xl sm:text-3xl font-bold ${
                        tier.darkBg ? "text-white" : "text-zinc-900"
                      }`}
                    >
                      {tier.price}
                    </span>
                  </div>

                  {/* CTA Button */}
                  <Link
                    href={tier.ctaHref}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm transition-all hover:scale-105"
                    style={{
                      backgroundColor: tier.color,
                      color: "#fff",
                    }}
                  >
                    {tier.cta}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </Link>
                </motion.div>

                {/* Right: Features Grid */}
                <motion.div
                  initial={{ opacity: 0, x: 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className={`grid gap-2 ${
                    tier.features.length <= 2 
                      ? "grid-cols-1 sm:grid-cols-2" 
                      : tier.features.length === 6
                        ? "grid-cols-2 lg:grid-cols-3"
                        : "grid-cols-2"
                  }`}
                >
                  {tier.features.map((feature) => (
                    <FeatureCard
                      key={feature.title}
                      feature={feature}
                      color={tier.color}
                      darkBg={tier.darkBg}
                    />
                  ))}
                </motion.div>
              </div>
            </div>
          </div>
        </div>

        {/* Example Slides */}
        {tier.slides.map((slide, slideIndex) => (
          <div
            key={slide.title}
            className="w-full h-full flex-shrink-0 snap-start"
          >
            <div className="h-full flex items-center justify-center px-6 lg:px-10">
              <div className="w-full max-w-4xl h-[82vh] flex items-center">
                {/* Example Card */}
                <motion.div
                  className={`relative overflow-hidden rounded-2xl w-full ${
                    tier.darkBg
                      ? "bg-white/5 border border-white/10"
                      : "bg-white border border-zinc-200 shadow-xl"
                  }`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                >
                  {/* Image placeholder */}
                  <div
                    className="h-[55vh] flex items-center justify-center"
                    style={{ backgroundColor: `${tier.color}08` }}
                  >
                    <div className="text-center">
                      <Image
                        src="/Audre_Logo.png"
                        alt={slide.title}
                        width={100}
                        height={100}
                        className="opacity-30 mx-auto mb-3"
                      />
                      <p className={`text-sm ${tier.darkBg ? "text-white/30" : "text-zinc-400"}`}>
                        Example preview coming soon
                      </p>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <div
                      className="inline-block px-3 py-1 rounded-full text-xs font-medium mb-2"
                      style={{ backgroundColor: `${tier.color}20`, color: tier.color }}
                    >
                      Example {slideIndex + 1}
                    </div>
                    <h3
                      className={`text-2xl font-bold mb-2 ${
                        tier.darkBg ? "text-white" : "text-zinc-900"
                      }`}
                    >
                      {slide.title}
                    </h3>
                    <p
                      className={`text-base ${
                        tier.darkBg ? "text-white/60" : "text-zinc-600"
                      }`}
                    >
                      {slide.desc}
                    </p>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation Dots - Fixed at bottom */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
        {Array.from({ length: totalSlides }).map((_, i) => (
          <button
            key={i}
            onClick={() => scrollToSlide(i)}
            className={`h-1.5 rounded-full transition-all ${
              activeSlide === i
                ? "w-6"
                : `w-1.5 ${tier.darkBg ? "bg-white/30 hover:bg-white/50" : "bg-zinc-300 hover:bg-zinc-400"}`
            }`}
            style={{
              backgroundColor: activeSlide === i ? tier.color : undefined,
            }}
          />
        ))}
      </div>

      {/* Scroll hint - only show on first slide */}
      {activeSlide === 0 && (
        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <p className={`text-[10px] ${tier.darkBg ? "text-white/40" : "text-zinc-400"}`}>
            Swipe to see examples →
          </p>
        </motion.div>
      )}
    </section>
  );
}

function ScrollIndicator({ text }: { text: string }) {
  return (
    <div className="py-6 text-center bg-white">
      <p className="text-zinc-400 text-sm font-medium tracking-wide uppercase">
        {text}
      </p>
    </div>
  );
}

export default function TiersPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hide scrollbar globally + animated gradient */}
      <style jsx global>{`
        .snap-x::-webkit-scrollbar {
          display: none;
        }
        @keyframes gradient {
          0% { background-position: 0% center; }
          50% { background-position: 100% center; }
          100% { background-position: 0% center; }
        }
        .animate-gradient {
          animation: gradient 4s ease infinite;
        }
      `}</style>

      {/* Header */}
      <motion.header
        className="fixed top-0 z-50 w-full bg-white/80 backdrop-blur-xl border-b border-zinc-200/50"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <Logo height={44} />
          <Link
            href="/"
            className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300 transition-all"
          >
            Back to Home
          </Link>
        </div>
      </motion.header>

      {/* Hero Section */}
      <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden pt-20" style={{ backgroundColor: "#f5f9fa" }}>
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#006682]/15 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#004563]/15 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#a0c0cb]/15 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-5xl mx-auto px-6 text-center">
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-100 text-zinc-600 text-sm font-medium mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            Three tiers. One mission.
          </motion.div>

          <motion.h1
            className="text-5xl sm:text-6xl lg:text-7xl font-bold text-zinc-900 mb-5 tracking-tight"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Find your{" "}
            <span 
              className="bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient"
              style={{
                backgroundImage: "linear-gradient(to right, #004563, #006682, #4faa92, #a0c0cb, #a46185, #564776, #004563)"
              }}
            >
              perfect 
            </span>
            {" "}fit
          </motion.h1>

          <motion.p
            className="text-lg sm:text-xl text-zinc-500 max-w-2xl mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Whether you need a quick health check or a full brand transformation,
            we have a tier designed for where you are and where you want to go.
          </motion.p>
        </div>
      </section>

      {/* Tier Sections */}
      <main>
        {tiers.map((tier, index) => (
          <div key={tier.name}>
            <TierSection tier={tier} index={index} />
            
          </div>
        ))}
      </main>

      {/* Final CTA */}
      <section className="relative py-24 overflow-hidden" style={{ backgroundColor: "#f0f7f8" }}>
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#4faa92]/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#564776]/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <motion.h2
            className="text-4xl sm:text-5xl font-bold text-zinc-900 mb-5"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Not sure which tier is right for you?
          </motion.h2>
          <motion.p
            className="text-lg text-zinc-500 mb-8 max-w-xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Let's chat. We'll help you find the best path forward for your brand.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-semibold text-lg bg-zinc-900 text-white hover:bg-zinc-800 transition-all hover:scale-105"
            >
              Let's Talk
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
