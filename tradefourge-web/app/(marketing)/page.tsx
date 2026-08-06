"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { HeroSection } from "@/components/landing/HeroSection";
import { StatsSection } from "@/components/landing/StatsSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { RoadmapSection } from "@/components/landing/RoadmapSection";
import { WhyTradeFourge } from "@/components/landing/WhyTradeFourge";
import { AIShowcase } from "@/components/landing/AIShowcase";
import { PricingSection } from "@/components/landing/PricingSection";
import { FAQSection } from "@/components/landing/FAQSection";

function StorytellingWrapper({
  children,
  zIndex,
}: {
  children: React.ReactNode;
  zIndex: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.95]);
  const opacity = useTransform(scrollYProgress, [0, 0.8, 1], [1, 0.9, 0.7]);

  return (
    <div
      ref={containerRef}
      style={{ zIndex }}
      className="sticky top-0 min-h-screen bg-[#0B0D13] flex flex-col justify-center transform-gpu"
    >
      <motion.div
        style={{ scale, opacity }}
        className="w-full h-full transition-transform duration-300 ease-out"
      >
        {children}
      </motion.div>
    </div>
  );
}

export default function MarketingLandingPage() {
  return (
    <div className="relative bg-[#0B0D13] overflow-clip selection:bg-blue-600 selection:text-white">
      {/* Storytelling Section 1: Hero & Stats */}
      <StorytellingWrapper zIndex={10}>
        <div className="flex flex-col justify-between min-h-screen">
          <HeroSection />
          <StatsSection />
        </div>
      </StorytellingWrapper>

      {/* Storytelling Section 2: Features */}
      <StorytellingWrapper zIndex={20}>
        <div className="border-t border-white/10 shadow-2xl bg-[#0B0D13] rounded-t-3xl">
          <FeaturesSection />
        </div>
      </StorytellingWrapper>

      {/* Storytelling Section 3: AI Showcase */}
      <StorytellingWrapper zIndex={30}>
        <div className="border-t border-white/10 shadow-2xl bg-[#0B0D13] rounded-t-3xl">
          <AIShowcase />
        </div>
      </StorytellingWrapper>

      {/* Storytelling Section 4: Why TradeFourge Comparison */}
      <StorytellingWrapper zIndex={40}>
        <div className="border-t border-white/10 shadow-2xl bg-[#0B0D13] rounded-t-3xl">
          <WhyTradeFourge />
        </div>
      </StorytellingWrapper>

      {/* Storytelling Section 5: Pricing Plans & Coupon Preview */}
      <StorytellingWrapper zIndex={50}>
        <div className="border-t border-white/10 shadow-2xl bg-[#0B0D13] rounded-t-3xl">
          <PricingSection />
        </div>
      </StorytellingWrapper>

      {/* Storytelling Section 6: Roadmap (Coming Soon) */}
      <StorytellingWrapper zIndex={60}>
        <div className="border-t border-white/10 shadow-2xl bg-[#0B0D13] rounded-t-3xl">
          <RoadmapSection />
        </div>
      </StorytellingWrapper>

      {/* Normal Scrolling Section: FAQ & Footer (Exits sticky stacking context) */}
      <div className="relative z-[70] bg-[#0B0D13] border-t border-white/10 shadow-2xl">
        <FAQSection />
      </div>
    </div>
  );
}
