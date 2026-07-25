"use client";

import React from "react";
import { HeroSection } from "@/components/landing/HeroSection";
import { StatsSection } from "@/components/landing/StatsSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { RoadmapSection } from "@/components/landing/RoadmapSection";
import { WhyTradeFourge } from "@/components/landing/WhyTradeFourge";
import { AIShowcase } from "@/components/landing/AIShowcase";
import { PricingSection } from "@/components/landing/PricingSection";
import { FAQSection } from "@/components/landing/FAQSection";

export default function MarketingLandingPage() {
  return (
    <div className="relative bg-[#0B0D13] overflow-clip">
      {/* Storytelling Section 1: Hero & Stats */}
      <div className="sticky top-0 z-10 min-h-screen bg-[#0B0D13] flex flex-col justify-between">
        <HeroSection />
        <StatsSection />
      </div>

      {/* Storytelling Section 2: Features */}
      <div className="sticky top-0 z-20 min-h-screen bg-[#0B0D13] border-t border-white/10 shadow-2xl flex flex-col justify-center">
        <FeaturesSection />
      </div>

      {/* Storytelling Section 3: AI Showcase */}
      <div className="sticky top-0 z-30 min-h-screen bg-[#0B0D13] border-t border-white/10 shadow-2xl flex flex-col justify-center">
        <AIShowcase />
      </div>

      {/* Storytelling Section 4: Why TradeFourge Comparison */}
      <div className="sticky top-0 z-40 min-h-screen bg-[#0B0D13] border-t border-white/10 shadow-2xl flex flex-col justify-center">
        <WhyTradeFourge />
      </div>

      {/* Storytelling Section 5: Pricing Plans & Coupon System */}
      <div className="sticky top-0 z-50 min-h-screen bg-[#0B0D13] border-t border-white/10 shadow-2xl flex flex-col justify-center">
        <PricingSection />
      </div>

      {/* Storytelling Section 6: Roadmap (Coming Soon) */}
      <div className="sticky top-0 z-60 min-h-screen bg-[#0B0D13] border-t border-white/10 shadow-2xl flex flex-col justify-center">
        <RoadmapSection />
      </div>

      {/* Normal Scrolling Section: FAQ (Transition out of storytelling stack) */}
      <div className="relative z-70 bg-[#0B0D13] border-t border-white/10 shadow-2xl">
        <FAQSection />
      </div>
    </div>
  );
}
